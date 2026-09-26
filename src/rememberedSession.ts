/** « Rester connecté » : la session Netlify Identity est gardée dans le
 *  stockage de l'appareil, mais son cookie `nf_jwt` n'a pas de date
 *  d'expiration. Le navigateur l'efface quand l'application est fermée pour
 *  de bon, et la bibliothèque déconnecte alors au lancement suivant, même
 *  si le jeton de renouvellement est encore valable. Quand la personne a
 *  choisi de rester connectée, on recrée ce cookie depuis la session
 *  gardée ; le jeton est ensuite renouvelé avant le chargement du planning.
 *
 *  Le jeton ne vaut qu'une heure et la bibliothèque le renouvelle avec une
 *  minuterie, suspendue quand le téléphone met l'application en veille. Au
 *  retour, et à chaque réponse « connexion requise », il est donc renouvelé
 *  avant de redemander la connexion. La bibliothèque efface aussi la session
 *  gardée au moindre renouvellement manqué, réseau absent compris : une
 *  copie de secours la remet en place à la tentative suivante. Seule la
 *  déconnexion volontaire l'efface.
 *
 *  Sans « Rester connecté », la connexion est redemandée à chaque nouvelle
 *  ouverture de l'application ; un simple rechargement ne la redemande pas. */
import { onAuthChange, refreshSession } from "@netlify/identity";

const REMEMBER_KEY = "planning:remember-session";
const SESSION_KEY = "gotrue.user";
const BACKUP_KEY = "planning:session-backup";
const LAUNCH_KEY = "planning:session-launch";
const SNAPSHOT_KEY = "planning:calendar-snapshot-v1";
const COOKIE_OPTIONS = "path=/; secure; samesite=lax";
const EXPIRED = "expires=Thu, 01 Jan 1970 00:00:00 GMT";

type Tokens = { accessToken: string; refreshToken: string };

export function rememberSessionEnabled() {
  try {
    // Choix par défaut : rester connecté, l'application étant personnelle.
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return false;
  }
}

export function setRememberSession(enabled: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, enabled ? "1" : "0");
    if (!enabled) {
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(SNAPSHOT_KEY);
    }
  } catch {}
}

function readCookie(name: string) {
  const found = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${name}=`));
  if (found === undefined) return null;
  try {
    return decodeURIComponent(found.slice(name.length + 1));
  } catch {
    return found.slice(name.length + 1);
  }
}

/** Les jetons d'une session enregistrée, s'il y en a une. */
function tokensOf(json: string | null): Tokens | null {
  try {
    const saved = JSON.parse(json || "null") as
      | { token?: { access_token?: unknown; refresh_token?: unknown } }
      | null;
    const accessToken = saved?.token?.access_token;
    const refreshToken = saved?.token?.refresh_token;
    if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** La session gardée ; si la bibliothèque l'a effacée, sa copie de secours
 *  est remise en place quand la personne a choisi de rester connectée. */
function savedTokens() {
  const tokens = tokensOf(read(SESSION_KEY));
  if (tokens || !rememberSessionEnabled()) return tokens;
  const backup = read(BACKUP_KEY);
  const restored = tokensOf(backup);
  if (restored && backup) {
    try { localStorage.setItem(SESSION_KEY, backup); } catch { return null; }
  }
  return restored;
}

/** Le serveur lit le cookie : il reprend les jetons de la session gardée. */
function syncCookies(tokens: Tokens) {
  if (readCookie("nf_jwt") === tokens.accessToken) return false;
  document.cookie = `nf_jwt=${encodeURIComponent(tokens.accessToken)}; ${COOKIE_OPTIONS}`;
  document.cookie = `nf_refresh=${encodeURIComponent(tokens.refreshToken)}; ${COOKIE_OPTIONS}`;
  return true;
}

/** À appeler avant `getUser()` au lancement. Sans « Rester connecté », ou
 *  sans session gardée, rien ne change : la connexion est redemandée.
 *  Renvoie vrai quand le cookie a été recréé. */
export function restoreRememberedSession() {
  if (typeof document === "undefined" || !rememberSessionEnabled()) return false;
  const tokens = savedTokens();
  if (!tokens) return false;
  try {
    return syncCookies(tokens);
  } catch {
    return false;
  }
}

/** Met à jour la copie de secours après une connexion ou un renouvellement :
 *  chaque renouvellement remplace le jeton de renouvellement précédent. */
export function keepSessionBackup() {
  try {
    if (!rememberSessionEnabled()) {
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(SNAPSHOT_KEY);
      return;
    }
    const session = localStorage.getItem(SESSION_KEY);
    if (tokensOf(session) && session && session !== localStorage.getItem(BACKUP_KEY))
      localStorage.setItem(BACKUP_KEY, session);
  } catch {}
}

/** Déconnexion volontaire : la copie de secours et le dernier planning
 *  gardé disparaissent avec la session. */
export function forgetRememberedSession() {
  try {
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {}
}

/** L'identifiant du compte de la session gardée. */
function sessionUserId() {
  try {
    const saved = JSON.parse(read(SESSION_KEY) || read(BACKUP_KEY) || "null") as { id?: unknown } | null;
    return typeof saved?.id === "string" && saved.id ? saved.id : null;
  } catch {
    return null;
  }
}

type CalendarSnapshot = { userId: string; savedAt: string; data: unknown; isAdmin?: boolean };

function readSnapshot() {
  try {
    const snapshot = JSON.parse(read(SNAPSHOT_KEY) || "null") as CalendarSnapshot | null;
    const userId = sessionUserId();
    return snapshot && userId && snapshot.userId === userId ? snapshot : null;
  } catch {
    return null;
  }
}

/** Ouverture immédiate : avec « Rester connecté », le dernier planning lu sur
 *  le serveur est gardé sur l'appareil pour s'afficher dès l'ouverture,
 *  pendant que le serveur est relu. Il n'appartient qu'au compte connecté. */
export function saveCalendarSnapshot(data: unknown) {
  const userId = sessionUserId();
  if (!rememberSessionEnabled() || !userId) return;
  const previous = readSnapshot();
  const snapshot: CalendarSnapshot = { userId, savedAt: new Date().toISOString(), data, isAdmin: previous?.isAdmin };
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {}
}

/** Retient aussi si le compte est administrateur, pour ses affichages. */
export function saveSnapshotAdmin(isAdmin: boolean) {
  const snapshot = readSnapshot();
  if (!snapshot || snapshot.isAdmin === isAdmin) return;
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ...snapshot, isAdmin })); } catch {}
}

/** Le dernier planning gardé pour le compte connecté, s'il y en a un. */
export function readCalendarSnapshot() {
  if (!rememberSessionEnabled()) return null;
  const snapshot = readSnapshot();
  return snapshot ? { data: snapshot.data, isAdmin: snapshot.isAdmin === true } : null;
}

/** Retient que cette ouverture de l'application est connectée : un
 *  rechargement ne redemande pas la connexion. Le repère disparaît avec la
 *  fenêtre de l'application. */
export function markSessionLaunch() {
  try { sessionStorage.setItem(LAUNCH_KEY, "1"); } catch {}
}

/** À appeler en tout premier au lancement. Sans « Rester connecté », une
 *  nouvelle ouverture de l'application oublie la session précédente : la
 *  connexion est redemandée. Renvoie vrai quand une session a été oubliée. */
export function forgetSessionAtNewLaunch() {
  if (typeof document === "undefined" || rememberSessionEnabled()) return false;
  try {
    if (sessionStorage.getItem(LAUNCH_KEY) === "1") return false;
  } catch {
    return false;
  }
  const hadSession = readCookie("nf_jwt") !== null || tokensOf(read(SESSION_KEY)) !== null;
  document.cookie = `nf_jwt=; ${COOKIE_OPTIONS}; ${EXPIRED}`;
  document.cookie = `nf_refresh=; ${COOKIE_OPTIONS}; ${EXPIRED}`;
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {}
  return hadSession;
}

let renewing: Promise<boolean> | null = null;

async function renewNow() {
  const tokens = savedTokens();
  if (!tokens) return false;
  syncCookies(tokens);
  try {
    await refreshSession();
  } catch {
    return false;
  }
  // Un renouvellement manqué efface la session gardée : on le constate ici,
  // la copie de secours servira à la tentative suivante.
  const renewed = tokensOf(read(SESSION_KEY));
  if (!renewed) return false;
  syncCookies(renewed);
  keepSessionBackup();
  return true;
}

/** Remet la session d'aplomb : les cookies reprennent les jetons gardés,
 *  puis le jeton est renouvelé s'il a expiré pendant la veille. Renvoie vrai
 *  quand une session valable existe encore. Les appels simultanés partagent
 *  le même renouvellement. */
export function renewSession() {
  if (typeof document === "undefined") return Promise.resolve(false);
  renewing ??= renewNow().finally(() => {
    renewing = null;
  });
  return renewing;
}

function isApiRequest(input: RequestInfo | URL) {
  if (typeof input !== "string" && !(input instanceof URL)) return false;
  try {
    const url = new URL(String(input), location.href);
    return url.origin === location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

let installed = false;

/** Chaque appel à `/api/…` refusé pour « connexion requise » renouvelle la
 *  session puis se rejoue une fois, avant que l'application ne redemande la
 *  connexion. Un appel refusé pour cette raison n'a rien enregistré : le
 *  rejouer ne crée pas de doublon. La copie de secours suit aussi chaque
 *  renouvellement fait par la bibliothèque. */
export function installSessionRenewal() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const baseFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await baseFetch(input, init);
    if (response.status !== 401 || !isApiRequest(input) || !(await renewSession())) return response;
    return baseFetch(input, init);
  };
  onAuthChange((event) => {
    if (event === "login" || event === "token_refresh") keepSessionBackup();
  });
}
