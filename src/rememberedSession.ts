/** « Rester connecté » : la session Netlify Identity est gardée dans le
 *  stockage de l'appareil, mais son cookie `nf_jwt` n'a pas de date
 *  d'expiration. Le navigateur l'efface quand l'application est fermée pour
 *  de bon, et la bibliothèque déconnecte alors au lancement suivant, même
 *  si le jeton de renouvellement est encore valable. Quand la personne a
 *  choisi de rester connectée, on recrée ce cookie depuis la session
 *  gardée ; le jeton est ensuite renouvelé avant le chargement du planning. */

const REMEMBER_KEY = "planning:remember-session";
const SESSION_KEY = "gotrue.user";

export function rememberSessionEnabled() {
  try {
    // Choix par défaut : rester connecté, l'application étant personnelle.
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return false;
  }
}

export function setRememberSession(enabled: boolean) {
  try { localStorage.setItem(REMEMBER_KEY, enabled ? "1" : "0"); } catch {}
}

function hasCookie(name: string) {
  return document.cookie.split("; ").some((cookie) => cookie.startsWith(`${name}=`));
}

/** À appeler avant `getUser()` au lancement. Sans « Rester connecté », ou
 *  sans session gardée, rien ne change : la connexion est redemandée. */
export function restoreRememberedSession() {
  if (typeof document === "undefined" || !rememberSessionEnabled() || hasCookie("nf_jwt")) return false;
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as
      | { token?: { access_token?: unknown; refresh_token?: unknown } }
      | null;
    const accessToken = saved?.token?.access_token;
    const refreshToken = saved?.token?.refresh_token;
    if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !accessToken || !refreshToken) return false;
    document.cookie = `nf_jwt=${encodeURIComponent(accessToken)}; path=/; secure; samesite=lax`;
    document.cookie = `nf_refresh=${encodeURIComponent(refreshToken)}; path=/; secure; samesite=lax`;
    return true;
  } catch {
    return false;
  }
}
