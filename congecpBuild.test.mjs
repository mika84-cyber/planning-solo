import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPECTED_SHEETS,
  STANDALONE_HEADERS,
  adaptStandalonePage,
  stampFormServiceWorker,
} from "./scripts/build-congecp.mjs";
import { planningApiAvailable } from "./public/formulaire/form-signature-controller.js";

const page = readFileSync("public/formulaire/index.html", "utf8");
const sheets = readFileSync("public/formulaire/sheets.js", "utf8");

/** Fenêtre minimale : ni démo publique, ni démo locale. */
function fakeWindow() {
  return {
    localStorage: { getItem: () => null },
    location: { hostname: "congecp.netlify.app" },
  };
}

/** Document minimal, avec ou sans déclaration d'API. */
function fakeDocument(content) {
  return {
    querySelector: (selector) =>
      selector === 'meta[name="planning-api"]' && content
        ? { getAttribute: () => content }
        : null,
  };
}

describe("site autonome Congé CP", () => {
  it("garde dans le formulaire les cinq feuilles attendues", () => {
    for (const id of EXPECTED_SHEETS) expect(sheets).toContain(`"id":"${id}"`);
  });

  it("retire le retour vers l’application et déclare l’absence d’API", () => {
    const adapted = adaptStandalonePage(page);
    expect(page).toContain('id="btnBackApp"');
    expect(adapted).not.toContain('id="btnBackApp"');
    expect(adapted).not.toContain("planning-solo-only");
    expect(adapted).toContain('<meta name="planning-api" content="none">');
    // Le reste de la page est intact : barre d’outils et choix du formulaire.
    expect(adapted).toContain('id="sheet"');
    expect(adapted).toContain('id="btnPdf"');
  });

  it("s’arrête si la page perd ses repères au lieu de produire un site cassé", () => {
    expect(() => adaptStandalonePage(page.replace('content="same-origin"', 'content="none"'))).toThrow();
    expect(() => adaptStandalonePage(page.replace("<!-- planning-solo-only:fin -->", ""))).toThrow();
  });

  it("rejoue les protections du site principal pour un dépôt à la main", () => {
    expect(STANDALONE_HEADERS).toContain("Content-Security-Policy: default-src 'self'");
    expect(STANDALONE_HEADERS).toContain("X-Frame-Options: DENY");
    expect(STANDALONE_HEADERS).toContain("X-Robots-Tag: noindex, nofollow, noarchive");
    expect(STANDALONE_HEADERS).toContain("Service-Worker-Allowed: /");
    expect(STANDALONE_HEADERS).toContain("Cache-Control: no-cache, no-store, must-revalidate");
  });

  it("date le cache du service worker pour que le dépôt remplace l’ancien", () => {
    const serviceWorker = readFileSync("public/formulaire/sw.js", "utf8");
    const stamped = stampFormServiceWorker(serviceWorker, "abc123def456");
    expect(stamped).toContain("var VERSION = 'abc123def456';");
    expect(stamped).toContain("var CACHE = 'demandes-' + VERSION;");
    expect(() => stampFormServiceWorker("var VERSION = 79;", "abc123def456")).toThrow();
  });

  it("garde la signature sur l’appareil quand la page déclare « none »", () => {
    expect(planningApiAvailable(fakeWindow(), fakeDocument("none"))).toBe(false);
    expect(planningApiAvailable(fakeWindow(), fakeDocument("same-origin"))).toBe(true);
    expect(planningApiAvailable(fakeWindow(), fakeDocument(""))).toBe(true);
  });

  it("laisse la démo publique hors synchronisation, comme avant", () => {
    const demo = {
      localStorage: {
        getItem: (key) =>
          key === "planning:public-demo-until" ? new Date(Date.now() + 60000).toISOString() : null,
      },
      location: { hostname: "planning.example" },
    };
    expect(planningApiAvailable(demo, fakeDocument("same-origin"))).toBe(false);
  });
});
