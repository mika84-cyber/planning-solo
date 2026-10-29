/* Après une mise à jour appliquée d'elle-même, la page se recharge : elle doit
   rouvrir là où l'on était — la rubrique, et le sous-écran de Ma paie — et le
   dire d'un mot. Le repère vit dans sessionStorage : il ne survit ni à un
   autre onglet ni à une fermeture. */
const KEY = "planning:resume-after-update";
/** Une reprise plus ancienne ne veut plus rien dire. */
const LIFETIME_MS = 60_000;

export type ResumedScreen = { section?: string; payScreen?: string; at?: number };

/** Note l'écran courant, lu dans l'historique, juste avant le rechargement. */
export function rememberScreenBeforeUpdate() {
  try {
    const state = history.state || {};
    sessionStorage.setItem(KEY, JSON.stringify({ section: state.planningSection, payScreen: state.payScreen, at: Date.now() }));
  } catch {
    // Sans stockage de session, la page rouvrira sur l'accueil.
  }
}

let resumed: ResumedScreen | null | undefined;

/** L'écran noté avant la mise à jour, lu une fois au lancement puis oublié
 *  par le stockage ; la même réponse pour tous ceux qui le demandent. */
export function resumedScreen(): ResumedScreen | null {
  if (resumed !== undefined) return resumed;
  resumed = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ResumedScreen) : null;
    if (parsed?.at && Date.now() - parsed.at < LIFETIME_MS) resumed = parsed;
  } catch {
    // Un repère illisible vaut une absence de repère.
  }
  return resumed;
}
