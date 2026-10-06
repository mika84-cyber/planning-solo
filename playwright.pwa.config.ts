import { defineConfig, devices } from "@playwright/test";

/* Tests de l'application installable (PWA) : contrairement à la suite
   principale, le service worker est actif. Il n'existe qu'en version de
   production : l'application est donc construite dans un dossier à part
   (dist-pwa-e2e) puis servie comme en ligne. */
const port = Number(process.env.PLAYWRIGHT_PWA_PORT || 5181);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e-pwa",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "fr-FR",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "pwa", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Un petit serveur qui relit les fichiers à chaque demande : un test peut
    // ainsi publier une nouvelle version en réécrivant sw.js.
    command: `npm run build:pwa-e2e && node scripts/serve-dist.mjs dist-pwa-e2e ${port}`,
    url: `${baseURL}/`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
