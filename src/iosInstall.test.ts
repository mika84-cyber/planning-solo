import { describe, expect, it } from "vitest";
import {
  APPLE_INSTALL_DISMISSED_KEY,
  appleInstallGesture,
  hasDismissedAppleInstall,
  isAlreadyInstalled,
  isAppleTouchDevice,
  rememberAppleInstallDismissed,
  shouldGuideAppleInstall,
} from "./iosInstall";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_BUREAU =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1";
const EDGE_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 EdgiOS/125.0 Mobile/15E148 Safari/604.1";
const FIREFOX_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const environnement = (partiel: Partial<Parameters<typeof shouldGuideAppleInstall>[0]>) => ({
  userAgent: IPHONE,
  maxTouchPoints: 5,
  platform: "iPhone",
  standalone: false,
  displayModeStandalone: false,
  ...partiel,
});

describe("reconnaissance de l’appareil", () => {
  it("reconnaît un iPhone", () => {
    expect(isAppleTouchDevice({ userAgent: IPHONE, maxTouchPoints: 5, platform: "iPhone" })).toBe(true);
  });

  it("reconnaît un iPad qui se fait passer pour un Mac", () => {
    // iPadOS 13 et suivants annoncent « Macintosh » : seuls les points de
    // contact les trahissent.
    expect(isAppleTouchDevice({ userAgent: IPAD_BUREAU, maxTouchPoints: 5, platform: "MacIntel" })).toBe(true);
  });

  it("ne confond pas un vrai Mac avec un iPad", () => {
    expect(isAppleTouchDevice({ userAgent: MAC, maxTouchPoints: 0, platform: "MacIntel" })).toBe(false);
  });

  it("ne dit rien sur Android, où le vrai bouton d’installation existe", () => {
    expect(isAppleTouchDevice({ userAgent: ANDROID, maxTouchPoints: 5, platform: "Linux armv8l" })).toBe(false);
  });
});

describe("application déjà installée", () => {
  it("détecte le lancement depuis l’écran d’accueil sur Safari", () => {
    expect(isAlreadyInstalled({ standalone: true, displayModeStandalone: false })).toBe(true);
  });

  it("détecte l’affichage autonome déclaré par le manifeste", () => {
    expect(isAlreadyInstalled({ standalone: false, displayModeStandalone: true })).toBe(true);
  });

  it("reste faux dans un onglet ordinaire", () => {
    expect(isAlreadyInstalled({ standalone: false, displayModeStandalone: false })).toBe(false);
  });
});

describe("faut-il expliquer l’installation ?", () => {
  it("oui sur un iPhone dans Safari", () => {
    expect(shouldGuideAppleInstall(environnement({}))).toBe(true);
  });

  it("non si l’application est déjà sur l’écran d’accueil", () => {
    expect(shouldGuideAppleInstall(environnement({ standalone: true }))).toBe(false);
  });

  it("non sur Android : Chrome propose son propre bouton", () => {
    expect(
      shouldGuideAppleInstall(
        environnement({ userAgent: ANDROID, platform: "Linux armv8l" }),
      ),
    ).toBe(false);
  });

  it("non sur un ordinateur", () => {
    expect(
      shouldGuideAppleInstall(
        environnement({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 0 }),
      ),
    ).toBe(false);
  });
});

describe("mémoire du bandeau écarté", () => {
  const stockage = () => {
    const valeurs = new Map<string, string>();
    return {
      getItem: (k: string) => valeurs.get(k) ?? null,
      setItem: (k: string, v: string) => void valeurs.set(k, v),
    };
  };

  it("se souvient que le bandeau a été fermé", () => {
    const s = stockage();
    expect(hasDismissedAppleInstall(s)).toBe(false);
    rememberAppleInstallDismissed(s);
    expect(hasDismissedAppleInstall(s)).toBe(true);
    expect(s.getItem(APPLE_INSTALL_DISMISSED_KEY)).toBe("1");
  });

  it("ne se bloque pas quand le stockage est refusé", () => {
    // Navigation privée : lire et écrire lèvent une exception. Le bandeau
    // reviendra, ce qui vaut mieux qu'un écran en erreur.
    const refuse = {
      getItem: () => {
        throw new Error("stockage indisponible");
      },
      setItem: () => {
        throw new Error("stockage indisponible");
      },
    };
    expect(hasDismissedAppleInstall(refuse)).toBe(false);
    expect(() => rememberAppleInstallDismissed(refuse)).not.toThrow();
  });
});

describe("où se trouve le geste selon le navigateur", () => {
  // Sur iOS tous les navigateurs sont du WebKit, mais l'ajout à l'écran
  // d'accueil n'est pas au même endroit dans chacun.
  it("Safari : le bouton Partager de la barre du bas", () => {
    expect(appleInstallGesture(IPHONE)).toBe("share");
  });

  it("Chrome : le menu à trois points", () => {
    expect(appleInstallGesture(CHROME_IOS)).toBe("menu");
  });

  it("Edge : le même menu que Chrome", () => {
    expect(appleInstallGesture(EDGE_IOS)).toBe("menu");
  });

  it("Firefox : renvoyer vers Safari plutôt que promettre un geste absent", () => {
    expect(appleInstallGesture(FIREFOX_IOS)).toBe("other");
  });
});
