/** Préparation des écrans ouverts à la demande.
 *
 *  Chaque écran secondaire est un module chargé à part, dont le nom change à
 *  chaque publication : sans préparation, sa première ouverture attend le
 *  réseau (un « petit temps » avant l'affichage). Une fois l'application
 *  prête et au repos, on charge donc ces modules à l'avance, un par un, puis
 *  on demande au navigateur de garder les images lourdes qui s'affichent
 *  ensuite (le fond du formulaire de congés, le QR code de l'audioguide).
 *  Rien n'est affiché ni exécuté de plus : les écrans s'ouvrent simplement
 *  sans attendre. */

const SCREEN_MODULES: ReadonlyArray<() => Promise<unknown>> = [
  () => import("./DayDetailDialog"),
  () => import("./PlanningRequestPanels"),
  () => import("./SchoolVacationUi"),
  () => import("./BalanceDetailDialog"),
  () => import("./PayPage"),
  () => import("./PayEstimateDetails"),
  () => import("./SundayDetailsList"),
  () => import("./PayslipCheckSection"),
  () => import("./UsefulFormsSection"),
  () => import("./UsefulContactsSection"),
  () => import("./WorkAccidentSection"),
  () => import("./ColleaguePlanningPage"),
];

/** Fichiers gardés par le navigateur pour un affichage immédiat. */
const PREFETCHED_FILES = [
  "/formulaire/form-bg-1.jpg",
  "/formulaire/form.css",
  "/formulaire/sheets.js",
  "/formulaire/app.js",
  "/useful-forms/audioguide-cezanne-qr.png",
];

let started = false;

function whenIdle(task: () => void) {
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(task, { timeout: 4000 });
  else window.setTimeout(task, 1500);
}

function prefetchFile(href: string) {
  if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  document.head.appendChild(link);
}

/** Lance la préparation une seule fois, quand le navigateur est au repos. */
export function warmUpScreens() {
  if (started || typeof window === "undefined") return;
  started = true;
  whenIdle(async () => {
    for (const load of SCREEN_MODULES) {
      try {
        await load();
      } catch {
        // Hors connexion ou publication en cours : l'écran se chargera à son ouverture.
      }
    }
    PREFETCHED_FILES.forEach(prefetchFile);
  });
}
