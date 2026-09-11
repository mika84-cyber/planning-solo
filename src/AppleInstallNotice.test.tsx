import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppleInstallNotice } from "./AppleInstallNotice";
import { APPLE_INSTALL_DISMISSED_KEY } from "./iosInstall";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36";

function simuler({
  userAgent = IPHONE,
  standalone = false,
  dismissed = false,
}: { userAgent?: string; standalone?: boolean; dismissed?: boolean } = {}) {
  const valeurs = new Map<string, string>();
  if (dismissed) valeurs.set(APPLE_INSTALL_DISMISSED_KEY, "1");
  vi.stubGlobal("navigator", {
    userAgent,
    maxTouchPoints: 5,
    platform: /iPhone/.test(userAgent) ? "iPhone" : "Linux armv8l",
    standalone,
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => valeurs.get(k) ?? null,
    setItem: (k: string, v: string) => void valeurs.set(k, v),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("bandeau d’installation sur appareil Apple", () => {
  it("explique les deux gestes sur un iPhone", () => {
    simuler();
    const html = renderToStaticMarkup(<AppleInstallNotice enabled />);
    expect(html).toContain("écran d’accueil");
    expect(html).toContain("Partager");
    // Aucune promesse d'installation en un clic : Safari ne le permet pas.
    expect(html).not.toContain("Installer l’application");
  });

  it("ne s’affiche pas sur Android, où le vrai bouton existe", () => {
    simuler({ userAgent: ANDROID });
    expect(renderToStaticMarkup(<AppleInstallNotice enabled />)).toBe("");
  });

  it("ne s’affiche pas si l’application est déjà sur l’écran d’accueil", () => {
    simuler({ standalone: true });
    expect(renderToStaticMarkup(<AppleInstallNotice enabled />)).toBe("");
  });

  it("ne revient pas une fois écarté", () => {
    simuler({ dismissed: true });
    expect(renderToStaticMarkup(<AppleInstallNotice enabled />)).toBe("");
  });

  it("reste muet tant que le compte n’est pas connecté", () => {
    // Même règle que le manifeste : rien n'est proposé sur la page publique.
    simuler();
    expect(renderToStaticMarkup(<AppleInstallNotice enabled={false} />)).toBe("");
  });
});

describe("le mode d’emploi suit le navigateur", () => {
  const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1";
  const FIREFOX_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15";

  it("Safari : envoie vers le bouton Partager", () => {
    simuler();
    const html = renderToStaticMarkup(<AppleInstallNotice enabled />);
    expect(html).toContain("Partager");
    expect(html).not.toContain("en haut à droite");
  });

  it("Chrome : envoie vers le menu à trois points, pas vers une barre absente", () => {
    simuler({ userAgent: CHROME_IOS });
    const html = renderToStaticMarkup(<AppleInstallNotice enabled />);
    expect(html).toContain("en haut à droite");
    expect(html).not.toContain("barre du bas");
  });

  it("Firefox : renvoie vers Safari", () => {
    simuler({ userAgent: FIREFOX_IOS });
    expect(renderToStaticMarkup(<AppleInstallNotice enabled />)).toContain("Safari");
  });
});
