/**
 * Installation sur iPhone et iPad.
 *
 * Safari ne déclenche jamais `beforeinstallprompt` : Apple ne permet à aucun
 * site de lancer l'installation. Le geste appartient à la personne — Partager,
 * puis « Sur l'écran d'accueil ». On ne peut donc pas proposer de bouton qui
 * installe ; seulement expliquer où appuyer.
 */

export type InstallEnvironment = {
  userAgent: string;
  /** iPadOS 13 et suivants se présentent comme un Mac : seul le nombre de
   *  points de contact les distingue d'un ordinateur. */
  maxTouchPoints: number;
  platform: string;
  /** `navigator.standalone`, propre à Safari : vrai depuis l'écran d'accueil. */
  standalone: boolean;
  /** L'affichage autonome déclaré par le manifeste, reconnu partout ailleurs. */
  displayModeStandalone: boolean;
};

export function isAppleTouchDevice({
  userAgent,
  maxTouchPoints,
  platform,
}: Pick<InstallEnvironment, "userAgent" | "maxTouchPoints" | "platform">) {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPad en mode « site pour ordinateur ».
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function isAlreadyInstalled({
  standalone,
  displayModeStandalone,
}: Pick<InstallEnvironment, "standalone" | "displayModeStandalone">) {
  return standalone || displayModeStandalone;
}

/**
 * Sur iOS, tous les navigateurs reposent sur WebKit, mais leur interface
 * diffère : le geste n'est pas au même endroit selon celui qu'on utilise.
 *
 * - `share` : Safari, où le bouton Partager est dans la barre du bas.
 * - `menu` : Chrome et Edge, où l'ajout se trouve dans le menu à trois
 *   points, en haut à droite.
 * - `other` : les navigateurs qui ne proposent pas l'ajout ; il faut alors
 *   ouvrir le planning dans Safari.
 */
export type AppleInstallGesture = "share" | "menu" | "other";

export function appleInstallGesture(userAgent: string): AppleInstallGesture {
  if (/CriOS\/|EdgiOS\//.test(userAgent)) return "menu";
  if (/FxiOS\//.test(userAgent)) return "other";
  return "share";
}

/**
 * La marche à suivre n'a de sens que sur un appareil Apple qui n'a pas déjà
 * l'application sur son écran d'accueil.
 */
export function shouldGuideAppleInstall(environment: InstallEnvironment) {
  return isAppleTouchDevice(environment) && !isAlreadyInstalled(environment);
}

export function readInstallEnvironment(): InstallEnvironment {
  const appleStandalone = (
    navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    standalone: appleStandalone === true,
    displayModeStandalone:
      typeof matchMedia === "function" &&
      matchMedia("(display-mode: standalone)").matches,
  };
}

export const APPLE_INSTALL_DISMISSED_KEY = "planning:apple-install-dismissed-v1";

/** Le bandeau ne revient pas une fois écarté ; l'entrée du menu, elle, reste
 *  toujours accessible pour retrouver la marche à suivre. */
export function hasDismissedAppleInstall(storage: Pick<Storage, "getItem">) {
  try {
    return storage.getItem(APPLE_INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAppleInstallDismissed(
  storage: Pick<Storage, "setItem">,
) {
  try {
    storage.setItem(APPLE_INSTALL_DISMISSED_KEY, "1");
  } catch {
    // Navigation privée ou stockage refusé : le bandeau reviendra, sans plus.
  }
}
