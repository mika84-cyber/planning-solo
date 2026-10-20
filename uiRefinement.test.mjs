// Finitions d'interface : des décisions prises au fil des passes, verrouillées
// pour qu'un retour en arrière se voie. Deux familles de contrôles :
// - les feuilles de style sont lues en règles et déclarations
//   (test-lib/cssRules.mjs) : un contrôle demande qu'un sélecteur ou qu'une
//   déclaration existe, jamais que le texte d'un fichier ait telle forme ;
// - les composants sont lus comme texte : ces contrôles disent ce qu'une page
//   contient ou ne contient plus. Le rendu lui-même est vérifié par les tests
//   de composants (*.test.tsx) et les parcours e2e.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadStylesheets } from "./test-lib/cssRules.mjs";

const appRoot = readFileSync(new URL("./src/App.tsx", import.meta.url), "utf8");
const appNavigation = readFileSync(new URL("./src/AppNavigation.tsx", import.meta.url), "utf8");
const homeDashboard = readFileSync(new URL("./src/HomeDashboard.tsx", import.meta.url), "utf8");
const payPage = readFileSync(new URL("./src/PayPage.tsx", import.meta.url), "utf8");
const payDashboard = readFileSync(new URL("./src/PayDashboard.tsx", import.meta.url), "utf8");
const payAllowancesSection = readFileSync(new URL("./src/PayAllowancesSection.tsx", import.meta.url), "utf8");
const pdfDownloadPage = readFileSync(new URL("./src/PdfDownloadPage.tsx", import.meta.url), "utf8");
const leaveManagementPage = readFileSync(new URL("./src/LeaveManagementPage.tsx", import.meta.url), "utf8");
const planningCommandCenter = readFileSync(new URL("./src/PlanningCommandCenter.tsx", import.meta.url), "utf8");
const schoolVacationUi = readFileSync(new URL("./src/SchoolVacationUi.tsx", import.meta.url), "utf8");
const planningDayCell = readFileSync(new URL("./src/PlanningDayCell.tsx", import.meta.url), "utf8");
const usefulResourcesHub = readFileSync(new URL("./src/UsefulResourcesHub.tsx", import.meta.url), "utf8");
const payslipCheckSection = readFileSync(new URL("./src/PayslipCheckSection.tsx", import.meta.url), "utf8");
const appDialogLayer = readFileSync(new URL("./src/AppDialogLayer.tsx", import.meta.url), "utf8");
const dayDetailDialog = readFileSync(new URL("./src/DayDetailDialog.tsx", import.meta.url), "utf8");
const balanceDetailDialog = readFileSync(new URL("./src/BalanceDetailDialog.tsx", import.meta.url), "utf8");
const requestSelectionPanel = readFileSync(new URL("./src/RequestSelectionPanel.tsx", import.meta.url), "utf8");
const planningRequestPanels = readFileSync(new URL("./src/PlanningRequestPanels.tsx", import.meta.url), "utf8");
const annualPdfActions = readFileSync(new URL("./src/AnnualPdfActions.tsx", import.meta.url), "utf8");
const payContent = readFileSync(new URL("./src/payContent.tsx", import.meta.url), "utf8");
const payAllowances = readFileSync(new URL("./src/payAllowances.ts", import.meta.url), "utf8");
const leaveStats = readFileSync(new URL("./src/leaveStats.ts", import.meta.url), "utf8");
const todayOverview = readFileSync(new URL("./src/todayOverview.ts", import.meta.url), "utf8");
const upcomingNoteList = readFileSync(new URL("./src/UpcomingNoteList.tsx", import.meta.url), "utf8");
const profileAdjustmentActions = readFileSync(new URL("./src/useProfileAdjustmentActions.ts", import.meta.url), "utf8");
const grandPalaisProgramData = readFileSync(new URL("./src/grandPalaisProgramData.ts", import.meta.url), "utf8");
const workTimeActions = readFileSync(new URL("./src/useWorkTimeActions.ts", import.meta.url), "utf8");
const payActions = readFileSync(new URL("./src/usePayActions.ts", import.meta.url), "utf8");
const authenticationActions = readFileSync(new URL("./src/useAuthenticationActions.ts", import.meta.url), "utf8");
const accountDataActions = readFileSync(new URL("./src/useAccountDataActions.ts", import.meta.url), "utf8");
const planningEntryActions = readFileSync(new URL("./src/usePlanningEntryActions.ts", import.meta.url), "utf8");
const planningRequestActions = readFileSync(new URL("./src/usePlanningRequestActions.ts", import.meta.url), "utf8");
const absenceReplacement = readFileSync(new URL("./src/absenceReplacement.ts", import.meta.url), "utf8");
const planningLogic = readFileSync(new URL("./src/planningLogic.ts", import.meta.url), "utf8");
const applicationStartup = readFileSync(new URL("./src/useApplicationStartup.ts", import.meta.url), "utf8");
const homeSectionScreen = readFileSync(new URL("./src/HomeSectionScreen.tsx", import.meta.url), "utf8");
const leaveSectionScreen = readFileSync(new URL("./src/LeaveSectionScreen.tsx", import.meta.url), "utf8");
const paySectionScreen = readFileSync(new URL("./src/PaySectionScreen.tsx", import.meta.url), "utf8");
const documentsSectionScreen = readFileSync(new URL("./src/DocumentsSectionScreen.tsx", import.meta.url), "utf8");
const planningWorkspace = readFileSync(new URL("./src/PlanningWorkspace.tsx", import.meta.url), "utf8");
// Les calculs sortis d'App.tsx dans leurs hooks : lus avec lui, pour que les
// contrôles qui portent sur un calcul suivent le code quand il est déplacé.
const extractedHooks = [
  "usePayProfileValues", "useMonthPayEstimate", "useLeaveBalances", "useNoteLists",
  "usePayMonthNavigation", "useWorkProfileActions", "usePartnerNoteActions", "useSectionNavigation",
  "useApplicationStartup", "useShellEffects", "useSharedDataPrefetch", "useRequestTypeSelection",
  "useWorkedDaysOverview", "useMecenatDraftCheck", "useDayDetailData",
]
  .map((name) => readFileSync(new URL(`./src/${name}.ts`, import.meta.url), "utf8"))
  .join("\n");
const app = [appRoot, extractedHooks, homeSectionScreen, leaveSectionScreen, paySectionScreen, documentsSectionScreen, planningWorkspace, appNavigation, homeDashboard, payPage, payDashboard, payAllowancesSection, pdfDownloadPage, leaveManagementPage, planningCommandCenter, schoolVacationUi, planningDayCell, usefulResourcesHub, payslipCheckSection, appDialogLayer, dayDetailDialog, balanceDetailDialog, requestSelectionPanel, planningRequestPanels, annualPdfActions, payContent, payAllowances, leaveStats, todayOverview, upcomingNoteList, profileAdjustmentActions, grandPalaisProgramData, workTimeActions, payActions, authenticationActions, accountDataActions, planningEntryActions].join("\n");
const stylesheetEntry = readFileSync(new URL("./src/styles.css", import.meta.url), "utf8");
// Les feuilles lues en règles et déclarations (test-lib/cssRules.mjs) : un
// contrôle porte sur un sélecteur ou une déclaration, jamais sur le texte des
// fichiers, qui peut être reformaté ou réparti autrement sans changer le rendu.
const css = loadStylesheets([
  ...[...stylesheetEntry.matchAll(/@import\s+"([^"]+)"/g)].map(
    ([, relativePath]) => new URL(`./src/${relativePath.replace(/^\.\//, "")}`, import.meta.url),
  ),
  // La page Congés, importée par main.tsx juste après styles.css.
  new URL("./src/styles/19-leave-page.css", import.meta.url),
  new URL("./src/grandPalaisProgram.css", import.meta.url),
  new URL("./src/payBulletin.css", import.meta.url),
]);
const model = readFileSync(new URL("./src/appModel.ts", import.meta.url), "utf8");
// Les en-têtes bicolores, chargés après toutes les autres feuilles.
const headers = loadStylesheets([new URL("./src/pageHeaders.css", import.meta.url)]);
const calendarApi = readFileSync(new URL("./src/calendarApi.ts", import.meta.url), "utf8");
const planningPdf = readFileSync(new URL("./src/planningPdf.ts", import.meta.url), "utf8");
const leaveForm = [
  "index.html",
  "device.js",
  "sheets.js",
  "app.js",
].map((file) => readFileSync(new URL(`./public/formulaire/${file}`, import.meta.url), "utf8")).join("\n");
const main = readFileSync(new URL("./src/main.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("./public/sw.js", import.meta.url), "utf8");
const calendarCleanup = readFileSync(new URL("./src/CalendarCleanup.tsx", import.meta.url), "utf8");
const leaveBalancesSection = readFileSync(new URL("./src/LeaveBalancesSection.tsx", import.meta.url), "utf8");
const payEstimateDetails = readFileSync(new URL("./src/PayEstimateDetails.tsx", import.meta.url), "utf8");
const appSections = readFileSync(new URL("./src/appSections.ts", import.meta.url), "utf8");
const leaveDialogs = readFileSync(new URL("./src/LeaveDialogs.tsx", import.meta.url), "utf8");
const workTimeDialogs = readFileSync(new URL("./src/WorkTimeDialogs.tsx", import.meta.url), "utf8");
const cetSection = readFileSync(new URL("./src/CetSection.tsx", import.meta.url), "utf8");
const requestValidationSummary = readFileSync(new URL("./src/RequestValidationSummary.tsx", import.meta.url), "utf8");
const planningDialogs = readFileSync(new URL("./src/PlanningDialogs.tsx", import.meta.url), "utf8");

describe("finitions d’interface", () => {
  it("garde la proposition d’installation dans le flux de la page", () => {
    expect(appRoot.indexOf('className="install-app-button"')).toBeLessThan(
      appRoot.indexOf('{homeSection === "home" ? ('),
    );
    expect(css.declarations(".install-app-button").position).not.toBe("fixed");
  });

  it("diffère les pages secondaires et met le profil de paie en avant", () => {
    expect(appSections).toContain('import("./PayPage").then');
    expect(appSections).toContain('import("./PayEstimateDetails").then');
    expect(appSections).toContain('import("./ColleaguePlanningPage").then');
    expect(appSections).not.toContain('const payPageModule = import("./PayPage")');
    expect(css.mentions(".pay-app-screen:has(.pay-dashboard)")).toBe(true);
    expect(css.declares("animation", "none")).toBe(true);
    expect(css.mentions(".pay-dashboard-profile-slot .pay-profile-symbol")).toBe(true);
  });

  it("isole les mutations directes et les lots de suppression du planning", () => {
    expect(appRoot).toContain("usePlanningEntryActions");
    expect(appRoot).not.toContain("async function saveSickDateDirect");
    expect(appRoot).not.toContain("async function deleteMultiplePlanningDates");
    expect(planningEntryActions).toContain("buildBulkDeleteOperations");
    expect(planningEntryActions).toContain("expectedUpdatedAt");
  });

  it("réserve la démonstration publique à un build temporaire avec échéance", () => {
    expect(app).toContain("VITE_PUBLIC_DEMO_UNTIL");
    expect(app).toContain("resolvePublicDemoAccess");
    expect(app).not.toContain('new URLSearchParams(location.search).has("demo")');
    expect(main).not.toContain("isDemoInstallationLink");
    expect(main).toContain("VITE_PUBLIC_DEMO_UNTIL");
    expect(main).toContain("!publicDemoBuild");
    expect(leaveForm).not.toContain("params.get('demo')");
    expect(leaveForm).toContain("planning:public-demo-until");
  });

  it("hiérarchise les actions CET et met en valeur les heures de récupération", () => {
    expect(css.mentions(".cet-toolbar .secondary-button")).toBe(true);
    expect(css.declares("background", "var(--surface)")).toBe(true);
    expect(workTimeDialogs).toContain("Heures à poser");
    expect(app).toContain("Heures à poser pour chaque date");
    expect(css.mentions(".recovery-duration-field .recovery-duration-choice button.active")).toBe(true);
  });

  it("affiche le CET en rubrique ouverte et distingue la rubrique Autre", () => {
    expect(css.hasRule(".cet-section-static .cet-heading-static")).toBe(true);
    expect(css.hasRuleWithSelectors([".leave-tool-disclosure > .overtime-balance-card", ".leave-tool-disclosure > .cet-section"])).toBe(true);
    expect(app).toContain('<strong id="leave-request-archive-title">Demandes archivées</strong>');
    expect(cetSection).toContain('className="cet-section open cet-section-static"');
    expect(cetSection).toContain("alimentation du 15 novembre au 31 décembre");
    expect(cetSection).not.toContain("setOpen");
    expect(cetSection).not.toContain("Planning Solo vous aide à suivre et simuler votre CET");
    expect(cetSection).toContain('placeholder="0" value={initialBalanceInput}');
    expect(cetSection).toContain('setInitialBalanceInput(value)');
    expect(css.mentions(".leave-request-archive .request-archive-icon")).toBe(true);
  });

  it("conserve le profil et la période de paie repliables", () => {
    expect(app).toContain('className="pay-profile-summary"');
    expect(app).toContain("aria-expanded={profileOpen}");
    // Les primes du mois en pastilles : un appui en montre le détail.
    expect(app).toContain('className="variable-pay-pills"');
    expect(app).toContain('className="variable-pay-pill-detail"');
  });

  it("anime le changement de mois sans gêner le défilement vertical", () => {
    expect(css.declares("touch-action", "pan-y")).toBe(true);
    expect(css.hasKeyframes("pay-month-out-left")).toBe(true);
    expect(css.hasKeyframes("pay-month-in-right")).toBe(true);
    expect(app).toContain("slideAllowancesMonth(deltaX < 0 ? 1 : -1)");
  });

  it("organise les cartes et commandes du planning pour le téléphone", () => {
    expect(css.anywhere("today-group-card")).toBe(false);
    expect(css.anyRuleDeclares(".controls .worked-days", { "grid-column": "1", "grid-row": "1" })).toBe(true);
    // Le choix du groupe a quitté les commandes du planning.
    expect(css.anywhere("planning-group-choice")).toBe(false);
    expect(css.mentions(".calendar-toolbar.month-toolbar .today-button")).toBe(true);
    expect(app).toContain("planning-workspace-shell");
  });

  it("affiche ASA, garde d’enfant, maladie et les deux moitiés de congé", () => {
    expect(app).toContain('markerType === "exceptional"');
    expect(app).toContain('myLeaveType === "childcare"');
    expect(app).toContain('myLeaveType === "sick"');
    expect(app).toContain('myLeaveType === "sick" ? "🤒"');
    expect(css.mentions(".day.leave-day.leave-exceptional")).toBe(true);
    expect(css.mentions(".day.leave-day.leave-childcare")).toBe(true);
    expect(css.mentions(".day.leave-day.leave-sick")).toBe(true);
    expect(css.mentions(".day.half-morning::after")).toBe(true);
    // Chaque moitié couvre son côté de la case ; le trait noir est l'ombre
    // interne vérifiée ci-dessous, pas une bordure.
    expect(css.anyRuleDeclares(".day.half-morning::after", { left: "-1px", right: "50%" })).toBe(true);
    expect(css.anyRuleDeclares(".day.half-afternoon::after", { right: "-1px", left: "50%" })).toBe(true);
    expect(css.declares("box-shadow", "inset 0 0 0 2px #000")).toBe(true);
    expect(css.declares("box-sizing", "border-box")).toBe(true);
    expect(css.declares("left", "0")).toBe(true);
  });

  it("présente les repères du jour en blocs, la journée en tête et le prochain férié travaillé", () => {
    const refinements = loadStylesheets([new URL("./src/productRefinements.css", import.meta.url)]);
    const overview = loadStylesheets([new URL("./src/homeOverview.css", import.meta.url)]);
    const home = readFileSync(new URL("./src/HomeDashboard.tsx", import.meta.url), "utf8");
    // L'ancienne fiche en grille et la page d'éphéméride ne reviennent pas.
    expect(css.anywhere(".today-overview-grid")).toBe(false);
    expect(refinements.mentions(".today-overview-grid")).toBe(false);
    expect(home).not.toContain("ephemeris");
    // Des lignes sur téléphone et sur le Z Fold ouvert (tactile, jusqu'à
    // 1100 px), des cartes côte à côte sur grand écran, cinq avec le férié.
    expect(overview.declares("grid-template-areas", '"icon label value go" "icon note value go"')).toBe(true);
    expect(overview.hasMedia("(min-width: 1101px), (min-width: 721px) and (pointer: fine)")).toBe(true);
    expect(overview.declaresTogether({ "grid-auto-flow": "column", "grid-auto-columns": "minmax(0, 1fr)" })).toBe(true);
    expect(home).toContain("Prochain férié travaillé");
    // La journée garde le même format que les autres lignes : sa couleur
    // n'est que sur l'icône et le libellé, sans fond coloré ni pastille.
    expect(overview.anyRuleDeclares(".today-status:is(.tone-leave, .tone-recovery)", { "--block-ink": "#9a2c40" })).toBe(true);
    expect(overview.anyRuleDeclares(".today-status", { "--block-ink": "#1d6b45", "--block-soft": "#e3f3e9" })).toBe(true);
    expect(overview.mentions(".today-status .today-block-label")).toBe(false);
    expect(overview.mentions(".today-status > strong")).toBe(false);
    expect(overview.usesValue("color-mix(in srgb, var(--block-ink) 8%, #fff)")).toBe(false);
    expect(home).toContain('<span className="today-block-label">Aujourd’hui</span>');
    expect(home).toContain("Prochain jour travaillé");
    expect(home).toContain("Congés restants");
  });

  it("mène chaque information manquante à l’endroit exact où elle se saisit", () => {
    // Chaque invitation ouvre son écran et descend jusqu'au bon bloc : la
    // liste des fériés, l'ajout d'un bulletin. Arriver en haut de la page
    // laisserait chercher.
    expect(app).toContain('title: "Profil de calcul"');
    expect(app).toContain("${missingHolidayChoices} à choisir");
    expect(app).toContain('title: "Bulletin de paie"');
    expect(app).toContain('title: "Groupe de planning"');
    expect(app).toContain('scrollWhenReady("holiday-choices")');
    // La vérification du bulletin se replie : l'accueil demande qu'elle
    // s'ouvre, puis la page y descend.
    expect(app).toContain("setPayVerificationRequested(true)");
    expect(payDashboard).toContain("verificationRequested");
    expect(app).toContain('id="holiday-choices"');
    expect(app).not.toContain("className=\"important-alert\"");
    // Un dimanche reporté se règle seul : il ne réclame rien à personne.
    expect(app).not.toContain("dimanche${s(sundayCarryover)} travaillé");
  });

  it("actualise les libellés demandés dans les primes", () => {
    expect(app).toContain("Primes pour le mois");
    expect(app).not.toContain("Jours fériés dans l’année");
    expect(app).not.toContain('className="step-label">Période de paie');
    expect(app).not.toContain("Jours fériés concernés");
  });

  it("tient la barre de navigation dans la palette et marque la rubrique courante", () => {
    // Elle était le seul élément froid d’une application chaude, avec des
    // couleurs écrites en dur : elle se lisait comme un bandeau rapporté.
    expect(css.anywhere("#e4ecf7")).toBe(false);
    expect(css.anywhere("#304f79")).toBe(false);
    expect(css.anywhere("#4c5e76")).toBe(false);
    // Le dock : chaque rubrique montre son nom ; la rubrique en cours passe en
    // pastille claire, avec un trait d'icône plus épais — la couleur seule ne
    // suffisait pas.
    expect(css.anyRuleDeclares(".section-dock > button.active", { background: "#fffdf9", color: "var(--accent-strong)" })).toBe(true);
    expect(css.anyRuleDeclares(".section-dock > button.active svg", { "stroke-width": "2.3" })).toBe(true);
  });

  it("rend la navigation mensuelle des primes confortable sur téléphone", () => {
    // Le mois en titre, les deux flèches regroupées à droite.
    expect(app).toContain('className="variable-pay-head variable-pay-head-c"');
    expect(app).toContain('className="variable-pay-arrows"');
    // Les flèches encadrent le mois : elles se fondent dans sa rangée (display: contents).
    expect(css.anyRuleDeclares(".variable-pay-head-c .variable-pay-arrows", { gap: "8px" })).toBe(true);
    expect(css.anyRuleDeclares(".variable-pay-head-c .variable-pay-month .variable-pay-arrows", { display: "contents" })).toBe(true);
  });

  it("propose l’arrêt maladie séparément et le retire du congé professionnel", () => {
    expect(app).toContain("Maladie");
    expect(app).toContain('onChoose("leave", "sick")');
    // Depuis une case, la maladie passe aussi par « Congé » puis ce choix.
    expect(app).not.toContain("saveSickDateDirect={saveSickDateDirect}");
    expect(app).toContain("prepareAbsenceReplacement");
    expect(planningRequestActions).toContain("prepareAbsenceReplacement");
    expect(absenceReplacement).toMatch(
      /AUTOMATICALLY_REFUNDED_TYPES\s*=\s*new Set<LeaveType>\(\[\s*"annual",\s*"half",?\s*\]\)/,
    );
    // La retenue maladie s'applique désormais aux deux statuts : un bulletin
    // réel de contractuel déduit bien le jour de carence (voir
    // src/payMonth.test.ts). L'ancienne mention « impact à vérifier », qui
    // masquait le montant aux contractuels, ne doit pas revenir.
    expect(app).toContain(': "carence et retenue de 10 %"');
    // Au-delà de trois mois d’arrêt, la ligne annonce le demi-traitement.
    expect(app).toContain("carence, 10 % puis 50 % : ");
    expect(app).not.toContain("impact à vérifier selon le maintien de salaire");
  });

  it("indique le groupe réellement présent avec l’utilisatrice aujourd’hui", () => {
    // Le comportement, échanges compris, est vérifié dans todayOverview.test.ts.
    expect(app).toContain("coWorkingGroupsForDate(today, group)");
    expect(app).toContain("Avec le groupe ${groups[0]}");
    expect(app).toContain('entry?.exchangeRole === "return"');
  });

  it("conserve uniquement la saisie par horaires pour les heures supplémentaires", () => {
    expect(workTimeDialogs).toContain('className="overtime-time-title">Horaires');
    expect(app).not.toContain("Nombre d’heures");
    expect(app).not.toContain('overtimeDraft.inputMode === "duration"');
    expect(app).toContain('inputMode: "range"');
  });

  it("garde le titre des catégories de paie accessible et permet de revenir aujourd’hui", () => {
    expect(app).toContain('className="pay-detail-sticky-header"');
    expect(app).toContain('aria-label="Fermer cette page"');
    expect(app).toContain('className={`pay-profile-open-copy');
    expect(app).toContain('{netEstimateComplete ? "Profil complet" : "À compléter"}');
    expect(app).not.toContain('profileOpen ? "Replier"');
    expect((payDashboard.match(/className="pay-bulletin-today"/g) || []).length).toBe(1);
    expect((payEstimateDetails.match(/className="pay-today-button"/g) || []).length).toBe(1);
    expect(app).toContain("Aucun dimanche versé sur cette paie");
    expect(css.mentions(".pay-detail-sticky-header")).toBe(true);
    expect(css.declares("position", "sticky")).toBe(true);
  });

  it("rend toute la zone de titre refermable et garde le mois dans la barre sticky", () => {
    expect(app).toContain('className="pay-detail-title-button"');
    expect(app).toContain('aria-label="Fermer cette page et revenir à Ma paie"');
    expect(css.mentions(".pay-detail-title-button")).toBe(true);
  });

  it("affiche l’état du profil dans son action et agrandit le calendrier mobile", () => {
    expect(app).toContain('pay-profile-open-copy${netEstimateComplete ? " complete" : " missing"}');
    expect(app).not.toContain('"Informations manquantes"');
    expect(css.mentions(".pay-profile-open-copy.complete")).toBe(true);
    expect(css.declares("min-height", "54px")).toBe(true);
  });

  it("laisse la quotité et le statut vides tant qu’ils n’ont pas été choisis", () => {
    // Les calculs retiennent bien un temps plein contractuel par défaut,
    // mais l’afficher ferait passer pour renseigné ce qui reste à décider.
    expect(paySectionScreen).toContain("workQuota: formProfile?.workQuota,");
    expect(paySectionScreen).toContain("status: formProfile?.status,");
    expect(payPage).toContain('placeholder="À renseigner"');
    expect(payPage).toContain("Quotité et statut à renseigner");
    expect(payPage).not.toContain('status={formProfile?.status || "contractuel"}');
    expect(css.mentions(".choice-picker-trigger.empty")).toBe(true);
  });

  it("ne rejoue jamais un lien d’authentification déjà consommé", () => {
    // Le jeton reste dans l’adresse après usage : au rechargement suivant,
    // l’application le rejouait et échouait sur un jeton mort, ce qui
    // renvoyait à l’écran de connexion après un mot de passe pourtant changé.
    expect(applicationStartup).toContain("const lienAuthentification =");
    expect(applicationStartup).toContain("const nettoyerLien = () =>");
    expect(applicationStartup).toContain("nettoyerLien();");
    expect(applicationStartup).toContain("Ce lien a déjà été utilisé ou a expiré");
  });

  it("n'affiche aucun brut trompeur tant que le profil de paie est incomplet", () => {
    expect(payEstimateDetails).toContain("const brut = grossEstimateComplete ? gross : null;");
    expect(payEstimateDetails).toContain('brut === null ? "À compléter" : euros(brut)');
  });

  it("enregistre plusieurs congés dans un lot idempotent unique", () => {
    expect(app).toContain("postCalendarPeriodsVerified");
    expect(calendarApi).toContain('action: "save-periods"');
    expect(calendarApi).toContain("postCalendarIdempotent");
  });

  it("compte Divers comme jour non travaillé et permet les suppressions multiples", () => {
    // Rangé sous « Repères du planning », Divers se dit en trois mots.
    expect(app).toContain("<strong>Divers</strong><span>Jour non travaillé</span>");
    expect(app).toContain('period.leaveType === "recovery"');
    expect(calendarCleanup).toContain("Effacer plusieurs dates ou notes");
    expect(app).toContain('className={`holiday-pay-amount');
  });

  it("pose Divers depuis la fiche du jour par le choix de durée, avec une punaise inclinée", () => {
    expect(app).toContain('onChoose("other", "other")');
    // La fiche du jour n'a plus de rubrique « Autres » : Divers se choisit
    // après « Congé », comme tous les types.
    expect(app).not.toContain("day-action-other");
    expect(app).not.toContain("saveOtherDateDirect");
    expect(css.declares("transform", "rotate(24deg)")).toBe(true);
    expect(css.mentions(".other-pin-head")).toBe(true);
    expect(css.mentions(".other-pin-needle")).toBe(true);
    expect(css.mentions(".day.leave-day.leave-other")).toBe(true);
    expect(css.declares("outline", "2px solid #000")).toBe(true);
  });

  it("colore l’action de suppression multiple", () => {
    expect(css.anyRuleDeclares(".calendar-bulk-delete-button", { width: "fit-content" })).toBe(true);
    expect(css.declaresTogether({ border: "1px solid var(--border-control)", "border-radius": "999px" })).toBe(true);
    expect(css.declares("color", "#a9243a")).toBe(true);
  });

  it("sépare chaque catégorie de solde entre congés pris et à venir", () => {
    expect(app).toContain("balanceDetailPeriods");
    expect(app).toContain('key: "taken"');
    expect(app).toContain('key: "upcoming"');
    expect(app).toContain('className="balance-detail-months"');
    expect(app).toContain("balance-detail-${period.key}");
    expect(app).toContain("period.units.toLocaleString");
    expect(app).toContain("Aucun congé dans cette rubrique");
    expect(css.mentions(".balance-detail-month > summary")).toBe(true);
    expect(css.mentions(".balance-detail-month[open]")).toBe(true);
  });

  it("garde l’effacement multiple sous la grille, avec son libellé complet", () => {
    // L'ancien bouton de la barre du mois n'est plus rendu.
    expect(css.anywhere("calendar-bulk-delete-mobile")).toBe(false);
    expect(css.anyRuleDeclares(".planning-workspace-shell.framed .calendar-bulk-delete-below", { display: "inline-flex" })).toBe(true);
    expect(css.anyRuleDeclares(".calendar-cleanup-label-short", { display: "none" })).toBe(true);
  });

  it("attend l’accord de l’utilisateur avant d’actualiser l’application installée", () => {
    expect(main).toContain('updateViaCache: "none"');
    expect(main).not.toContain('addEventListener("controllerchange"');
    expect(main).not.toContain("window.location.reload()");
    expect(main).toContain('addEventListener("visibilitychange"');
    expect(main).toContain("registration.update()");
    expect(serviceWorker).toContain('fetch(event.request, { cache: "no-store" })');
    expect(serviceWorker).toContain('event.data?.type === "SKIP_WAITING"');
    expect(serviceWorker.match(/self\.addEventListener\("install"[\s\S]*?\n\}\);/)?.[0]).not.toContain("skipWaiting");
    expect(app).toContain("checkForAppUpdate");
    expect(app).toContain('className={`header-update-button');
    expect(app).toContain("Vérifier les mises à jour");
    expect(app).toContain("Une mise à jour est disponible");
    expect(app).toContain("planning-app-update-available");
    expect(main).toContain('registration.addEventListener("updatefound"');
    expect(main).toContain("2 * 60 * 1000");
    expect(app).toContain("<AppUpdateDialog");
    expect(planningDialogs).toContain("Mettre à jour maintenant");
    expect(planningDialogs).toContain('className="save-button update-now-button"');
    expect(planningDialogs).toContain("La page ne sera actualisée qu’après votre confirmation");
    expect(css.mentions(".header-update-button.checking")).toBe(true);
    expect(css.mentions(".update-available-modal .update-now-button")).toBe(true);
    expect(css.declares("background", "#c52f42")).toBe(true);
  });

  it("affiche Divers en doré sans pastille dans le choix des absences", () => {
    expect(app).not.toContain('className="other-choice-dot"');
    // Le doré de Divers vient de sa famille de choix.
    const requestChoiceFamilies = loadStylesheets([new URL("./src/requestChoiceFamilies.css", import.meta.url)]);
    expect(requestChoiceFamilies.anyRuleDeclares(".request-choice .request-choice-row.leave-choice-other", { "--leave-choice-accent": "#d9ab2b" })).toBe(true);
    expect(app).not.toContain("(Grève, décharge syndicale, fermeture exceptionnelle)");
  });

  it("permet de revenir à l’application depuis le formulaire", () => {
    expect(leaveForm).toContain('id="btnBackApp"');
    expect(leaveForm).toContain("Revenir à l’application");
    expect(leaveForm).toContain('id="btnBackApp" href="/"');
  });

  it("allège l’enregistrement et déplace la gestion d’un congé vers la fiche du jour", () => {
    expect(app).not.toContain("Périodes enregistrées");
    expect(app).not.toContain("balance-multi-delete-toggle");
    expect(app).not.toContain("balance-detail-checkbox");
    expect(app).not.toContain("balance-detail-cancel");
    expect(app).toContain("voir et gérer cette absence");
    expect(app).toContain("Ouvrez les congés déjà pris ou les congés à venir");
  });

  it("place les absences avant les notes avec deux actions de même taille", () => {
    expect(calendarCleanup.indexOf("Effacer les absences")).toBeLessThan(calendarCleanup.indexOf("Effacer les notes"));
    expect(css.hasRuleWithSelectors([".calendar-delete-actions .delete-absences-button", ".calendar-delete-actions .delete-notes-button"])).toBe(true);
    expect(css.declares("min-height", "46px")).toBe(true);
  });

  it("place Aujourd’hui sous la période sur téléphone", () => {
    expect(css.anyRuleDeclares(".calendar-toolbar.month-toolbar .today-button", { "grid-column": "1", "grid-row": "2" })).toBe(true);
  });

  it("garde les détails des jours travaillés dans l’écran", () => {
    expect(css.anyRuleDeclares(".app-shell .controls .worked-days .worked-days-panel", { top: "calc(100% + 8px)", right: "0", bottom: "auto", left: "0" })).toBe(true);
    expect(css.declares("max-height", "min(58dvh, 420px)")).toBe(true);
  });

  it("affiche Divers en doré avec une punaise rouge", () => {
    expect(app).toContain('personalDay ? " personal-day" : ""');
    expect(app).toContain('className={`other-pin${compact ? " compact" : ""}`}');
    expect(css.hasRuleWithSelectors([".month-card .calendar-grid .day.leave-day.leave-other", ".month-card .calendar-grid .day.personal-day"])).toBe(true);
    expect(css.declares("color", "#d51f3b")).toBe(true);
    expect(css.declares("background", "#f3d884 !important")).toBe(true);
  });

  it("compacte le montant des fériés choisis et espace la navigation de paie", () => {
    expect(payAllowancesSection).toContain('className={`holiday-pay-amount');
    // Un clic sur le montant ouvre directement les choix, Échanger compris.
    expect(payAllowancesSection).toContain("holiday-pay-options");
    expect(payAllowancesSection).toContain("<span>Échanger</span>");
    expect((payAllowancesSection.match(/holidayChoice\(item\)/g) || []).length).toBe(2);
    // Le détail du calcul : le mois entre ses deux flèches, comme la page principale.
    expect(payEstimateDetails).toContain('className="pay-detail-month-bar"');
    expect(css.anyRuleDeclares(".holiday-pay-amount", { width: "fit-content" })).toBe(true);
    expect((payEstimateDetails.match(/className="pay-detail-month-arrow"/g) || []).length).toBe(2);
  });

  it("donne le même liseré aux tableaux Planning et Couleurs des deux PDF", () => {
    expect(planningPdf).toContain("const panelBorderWidth = 0.42");
    // Pied de page : le résumé et la légende ont chacun leur cadre au même trait.
    expect((planningPdf.match(/setLineWidth\(panelBorderWidth\)/g) || []).length).toBe(2);
  });

  it("réunit la préparation puis propose formulaire ou enregistrement direct", () => {
    expect(app).toContain('openRequestChooser("planning", date)');
    // La fiche du jour : « Congé » et « Notes », puis un lien de fermeture.
    expect(app).not.toContain("openPlanningRequestMethod");
    expect(app).toContain('className="day-closure-link"');
    expect(planningLogic).toContain('"recovery_day",');
    expect(planningLogic).toContain('"recovery_half",');
    expect(planningLogic).toContain('"recovery_hours",');
    expect(planningLogic).toContain('"recovery_holiday",');
    expect(planningLogic).toContain('"recovery_training",');
    expect(app).toContain("Enregistrer et préparer le formulaire");
    expect(app).toContain("Enregistrer sans formulaire");
    expect(app).toContain("Annuler la demande");
    expect(app).toContain("Le formulaire est préparé, mais jamais envoyé automatiquement");
    expect(app).toContain("Vous pouvez mélanger plusieurs types dans une même demande.");
    expect(app).toContain("Étape 2 sur 3 · Choisissez les dates");
    expect(app).toContain("Autres types de congé");
    expect(app).toContain('<div className="day-action-grid">');
    expect(app).toContain('className="day-note-tile"');
    expect(app).not.toContain('role="tablist" aria-label="Contenu de la journée"');
    expect(workTimeDialogs).toContain('[480, "8 h"], [360, "6 h"], [240, "4 h"], [225, "3 h 45"], [120, "2 h"]');
    expect(workTimeDialogs).toContain('defaultRecoveryMinutes(draft.kind, effectiveQuota)');
    expect(workTimeDialogs).toContain('draft.kind === "holiday" ? [] : [[null, "Durée libre"]]');
    expect(workTimeDialogs).toContain('defaultRecoveryMinutes(kind, effectiveQuota)');
    expect(workTimeDialogs).toContain("getDayInfo(chosenDate, group)");
    expect(workTimeDialogs).toContain("Sélectionner dans le calendrier");
    expect(workTimeDialogs).toContain("Ajouter une récupération");
    expect(workTimeDialogs).toContain("Type de récupération");
    expect(app).toContain("recoveryDatePicking");
    expect(app).toContain('? "CA"');
    expect(app).toContain('? "RTT"');
    expect(app).toContain('? "FRA"');
    expect(app).toContain('className={`recovery-calendar-label');
    expect(app).toContain(">REC</span>");
  });

  it("uniformise les libellés de compensation et les sélecteurs mobiles", () => {
    expect(model).toContain('label: "Prime + récup"');
    expect(model).not.toContain("Prime + 1 jour de récup");
    // Les trois choix d'un férié se touchent directement : plus de menu.
    expect(css.anyRuleDeclares(".holiday-pay-options", { display: "grid" })).toBe(true);
  });

  it("distingue la zone du planning mensuel du tableau toutes zones du PDF", () => {
    expect(pdfDownloadPage).not.toContain("schoolVacationZone");
    expect(pdfDownloadPage).toContain("Ajouter les vacances scolaires au planning");
    expect(schoolVacationUi).toContain("SCHOOL_ZONE_OPTIONS");
    expect(schoolVacationUi).toContain("Zone scolaire affichée");
  });

  it("équilibre les commandes du planning sur grand écran", () => {
    expect(css.declares("grid-template-columns", "repeat(4, minmax(0, 1fr))")).toBe(true);
    expect(css.declares("grid-template-columns", "repeat(3, minmax(0, 1fr))")).toBe(true);
    // La vue annuelle a été retirée : c'est la barre du mois qui se répartit
    // désormais, et plus la barre de l'année.
    expect(css.anywhere("annual-toolbar")).toBe(false);
    expect(css.mentions(".calendar-toolbar.month-toolbar .period-navigation")).toBe(true);
    expect(css.declares("grid-column", "1 / -1")).toBe(true);
  });

  it("rend les cartes du tableau de bord de paie et les dernières absences immédiatement repérables", () => {
    expect(css.mentions(".pay-bulletin .pay-bulletin-layout")).toBe(true);
    expect(css.declares("border", "1px solid var(--border-card)")).toBe(true);
    expect(app).toContain("recentBalanceDetailDates.has(detail.date)");
    expect(css.mentions(".recent-leave-date")).toBe(true);
  });

  it("permet une note multi-jours et un crédit manuel de solidarité", () => {
    expect(app).toContain("Choisir le ou les jours");
    expect(app).toContain('aria-label="Date de la note"');
    expect(workTimeDialogs).toContain("Ajouter des heures manuellement");
    expect(app).toContain('createClientId("solidarity")');
    expect(workTimeDialogs).toContain('disposition: "recovery"');
  });

  it("regroupe les commandes de l’en-tête et harmonise le groupe", () => {
    expect(app).toContain('className="header-control-cluster"');
    expect(app).toContain("Prochain jour travaillé");
    expect(css.anywhere(".planning-group-action-row")).toBe(false);
    expect(css.mentions(".leave-request-archive")).toBe(true);
  });

  it("retire le bouton d’actualisation circulaire de l’en-tête", () => {
    expect(app).not.toContain("header-refresh-button");
    expect(app).not.toContain("Rafraîchir le planning");
  });

  it("permet la reprise annuelle sans dates et ouvre la fiche depuis un solde", () => {
    expect(leaveBalancesSection).toContain("Reprendre mes absences précédentes");
    expect(leaveBalancesSection).toContain("Ajouter un historique sans renseigner chaque date");
    expect(leaveBalancesSection).toContain("Choisir l’année des absences");
    expect(leaveDialogs).toContain("Dimanches posés en congé");
    expect(leaveDialogs).toContain("Prime de juillet");
    expect(leaveDialogs).toContain("Prime d’octobre");
    expect(leaveDialogs).toContain("Prime de décembre");
    expect(app).toContain('className="balance-detail-open"');
    expect(app).toContain('className="balance-detail-guidance"');
    expect(app).toContain('label: "Congés déjà pris"');
    expect(app).toContain('label: "Congés à venir"');
    expect(app).toContain("manualSundayLeaveJanJun");
    expect(css.mentions(".manual-adjustments-modal")).toBe(true);
  });

  it("ne propose plus de mode d’emploi dans l’application", () => {
    expect(app).not.toContain("planning:guide-seen-v1:");
    expect(app).not.toContain("Besoin d’un mode d’emploi rapide ?");
    expect(app).not.toContain("UserGuideDialogs");
  });

  it("rend les actions d’un congé visibles sans menu intermédiaire", () => {
    expect(app).toContain('className="period-direct-actions"');
    expect(app).toContain('className="period-edit-button"');
    expect(app).toContain('className="period-delete-button"');
    expect(app).toContain("Annuler le congé");
    expect(app).not.toContain("Repasser en souhaité");
    expect(app).not.toContain("period-menu-trigger");
    expect(css.mentions(".period-direct-actions")).toBe(true);
  });

  it("affiche un résumé des dates avant la validation", () => {
    expect(app).toContain("<RequestValidationSummary");
    expect(requestValidationSummary).toContain("Résumé avant validation");
    expect(requestValidationSummary).toContain("Effet de la validation");
  });

  it("réduit le menu principal aux pages de l’application", () => {
    // Le menu ne fait plus qu'une chose : mener à une page. Le mode d'emploi
    // l'accompagne parce qu'il explique ces pages-là.
    expect(appNavigation).toContain("const MENU_PAGES");
    expect(appNavigation).toContain("Les pages de l’application");
    // La mise à jour a quitté le menu pour l'en-tête ; les pages puis les
    // outils (données, installation, messagerie) s'y suivent.
    expect(appNavigation).not.toContain("main-menu-refresh");
    expect(appNavigation).toContain("main-menu-section-label");
    expect(appNavigation).toContain("Installer l’application");
    expect(appNavigation).toContain("Messagerie interne");
    expect(appNavigation).not.toContain("Mode d’emploi");
    expect(appNavigation).not.toContain("Compte et réglages");
    expect(appNavigation).not.toContain("État de sauvegarde");
    expect(appNavigation).toContain("Mes données");
    expect(css.anywhere(".main-menu-refresh")).toBe(false);
    expect(documentsSectionScreen).toContain("<UsefulResourcesHub");
    // Les plannings PDF s'ouvrent depuis le calendrier, dans une fenêtre.
    expect(planningWorkspace).toContain("planning-pdf-dialog");
    expect(usefulResourcesHub).not.toContain('key: "pdf"');
    expect(usefulResourcesHub).toContain("useful-resources-screen");
    expect(app).not.toContain("Sauvegarde et restauration");
    expect(css.mentions(".main-menu-secondary .guide-menu-entry")).toBe(true);
    expect(css.usesValue("url(\"/menu-art-fast.webp\")")).toBe(true);
    expect(css.mentions(".main-menu-drawer > .main-menu-hero")).toBe(true);
    expect(app).toContain('className="main-menu-index"');
    expect(app).toContain('className="main-menu-chevron"');
    expect(app).toContain("header-command-area");
    expect(app).toContain("header-update-button");
    expect(css.mentions(".header-update-button")).toBe(true);
    expect(css.mentions(".header-update-dot")).toBe(true);
    expect(app).not.toContain("menu-update-button");
  });

  it("aère l’arrêt maladie", () => {
    expect(app).toContain("sick-request-panel");
    expect(css.mentions(".sick-request-options .request-option-group")).toBe(true);
    expect(css.declares("grid-template-columns", "minmax(180px, 0.62fr) minmax(240px, 1.38fr)")).toBe(true);
  });

  it("ne garde aucune trace de la vue annuelle", () => {
    // Elle ne servait pas, et son seul reste utile — les trois exports PDF —
    // ne dépend plus d'elle.
    expect(app).not.toContain("year-grid");
    expect(app).not.toContain("mini-month");
    expect(app).not.toContain('mode === "year"');
    expect(app).not.toContain("Mode d’affichage");
  });

  it("intègre l’œuvre en texture discrète dans l’en-tête", () => {
    expect(css.usesValue("url(\"/header-art-fast.webp\")")).toBe(true);
    expect(css.usesValue("rgba(255, 249, 232, 0.62)")).toBe(true);
    expect(css.usesValue("rgba(253, 250, 244, 0.3)")).toBe(true);
    expect(css.declares("border-color", "var(--border-card)")).toBe(true);
  });

  it("donne la même hauteur à tous les en-têtes, quelle que soit la page", () => {
    expect(headers.declaresTogether({ height: "170px !important", "min-height": "170px !important" })).toBe(true);
    expect(headers.declaresTogether({ height: "156px !important", "min-height": "156px !important" })).toBe(true);
    expect(css.declares("border-color", "var(--border-card)")).toBe(true);
  });

  it("ne garde plus d’image derrière les titres d’en-tête, seulement dans le menu", () => {
    expect(app).toContain('className="app-shell"');
    expect(css.usesValue("url(\"/menu-art-fast.webp\")")).toBe(true);
    // Deux aplats de couleur ; les anciennes couches d'image sont masquées.
    expect(headers.anyRuleDeclares(":root .app-shell .top-header::after", { display: "none !important" })).toBe(true);
    expect(headers.usesValue("linear-gradient(112deg, var(--header-a) 0 57%")).toBe(true);
    expect(css.anywhere("/home-art.jpg")).toBe(false);
    expect(css.anywhere("/leave-art.jpg")).toBe(false);
    expect(css.anywhere("/pay-art.jpg")).toBe(false);
    expect(css.anywhere("/pdf-art.jpg")).toBe(false);
  });

  it("permet de balayer les rubriques principales sur téléphone", () => {
    expect(appNavigation).toContain("export const MAIN_SECTION_ORDER");
    for (const section of ["home", "leave", "pay", "pdf", "program", "forms", "colleagues"])
      expect(appNavigation).toContain(`"${section}"`);
    expect(app).toContain("onTouchStart={startSectionSwipe}");
    expect(app).toContain("onTouchEnd={finishSectionSwipe}");
    expect(app).toContain("Math.abs(deltaX) < 48");
  });

  it("propose le mode sombre dans le menu et réduit le téléchargement des formulaires à son icône", () => {
    // Le mode sombre est dérivé des feuilles de style au lancement (src/darkStyles.ts),
    // pas écrit en double dans les fichiers CSS.
    expect(app).toContain("<ThemeSwitch />");
    expect(main).toContain("initTheme();");
    expect(css.anywhere("html[data-theme=\"dark\"]")).toBe(false);
    expect(css.mentions(".useful-form-download-label")).toBe(true);
    expect(css.declaresTogether({ width: "42px", height: "42px" })).toBe(true);
  });

  it("renforce la lisibilité du menu et les contours de l’en-tête", () => {
    expect(css.anyRuleDeclares(".main-menu-copy strong", { color: "#fff" })).toBe(true);
    expect(css.anyRuleDeclares(".main-menu-copy small", { overflow: "hidden", color: "rgba(253, 250, 244, 0.9)" })).toBe(true);
    expect(css.mentions(".top-header .account-button")).toBe(true);
    expect(css.declares("border", "1.5px solid var(--border-card)")).toBe(true);
  });

  it("centre l’image de chargement sur téléphone", () => {
    expect(css.anyRuleDeclares(".auth-splash-image", { "object-fit": "cover", "object-position": "46% 50%" })).toBe(true);
  });

  it("dessine un liseré noir autour des en-têtes et de leurs onglets", () => {
    expect(css.declares("border-color", "var(--border-card)")).toBe(true);
    // La bascule Mois / Année a été retirée : ce sont les trois commandes
    // restantes de l'en-tête qui portent ce liseré sur les œuvres colorées.
    expect(css.anywhere("view-switch")).toBe(false);
    expect(css.anyRuleDeclares(".top-header .header-update-button", { border: "1.5px solid var(--border-card)" })).toBe(true);
  });

  it("harmonise les cadres principaux et secondaires de l’application", () => {
    expect(css.declaresProperty("--app-frame-strong")).toBe(true);
    expect(css.declaresProperty("--app-frame-soft")).toBe(true);
    expect(css.mentions(".cet-subsection")).toBe(true);
    expect(css.declarations(".leave-balances-direct .leave-balance-grid button").border).toMatch(/^1px solid color-mix\(/);
    expect(css.mentions(".request-option-group")).toBe(true);
  });

  it("garde l’ordre des tuiles de soldes sur les grands écrans", () => {
    expect(css.hasMedia("(min-width: 721px)")).toBe(true);
    expect(css.mentions(".leave-balance-grid > button:is(.childcare, .exceptional, .other, .cet, .work_accident, .strike)")).toBe(true);
    expect(css.declares("order", "initial")).toBe(true);
    // Les anciens ordres forcés (Divers, Grève, CET) étaient annulés par cette règle.
    expect(css.declarations(".leave-balances-direct .leave-balance-grid button.strike", "(min-width: 721px)").order).toBeUndefined();
  });

  it("renforce la lisibilité des soldes sans retirer leurs couleurs", () => {
    expect(css.usesValue("color-mix(in srgb, var(--balance-color) 58%, #2c2621)")).toBe(true);
    expect(css.anyRuleDeclares(".leave-balances-direct .leave-balance-grid small", { color: "var(--muted)" })).toBe(true);
    expect(css.usesValue("color-mix(in srgb, var(--balance-color) 52%, var(--border-card))")).toBe(true);
  });

  it("élargit uniquement l’en-tête sur les grands écrans", () => {
    expect(css.hasMedia("(min-width: 1200px)")).toBe(true);
    expect(css.declares("width", "calc(100% + 64px)")).toBe(true);
    expect(css.declares("margin-left", "-32px")).toBe(true);
  });

  it("aligne l’action contextuelle en haut à droite de l’encadré Aujourd’hui", () => {
    expect(css.anyRuleDeclares(".today-overview-heading", { "align-items": "flex-start" })).toBe(true);
    expect(css.anyRuleDeclares(".today-overview-heading .add-action", { "align-self": "flex-start" })).toBe(true);
  });

  it("place le choix du groupe dans Aujourd’hui et la pose de congé avant le mois", () => {
    expect(app).toContain('className="primary-action add-action group-heading-action"');
    expect(app).toContain('`Je suis groupe ${group}`');
    expect(app).not.toContain('className="today-group-card"');
    expect(app).toContain("primary-action planning-leave-action");
    expect(app).toContain('className="planning-leave-panel"');
    expect(css.hasRule(".planning-leave-panel .planning-leave-action")).toBe(true);
    expect(css.declares("width", "100% !important")).toBe(true);
  });

  it("retire les filtres Afficher et place la pose de congé contre le calendrier", () => {
    expect(app).not.toContain('className="shared-tools"');
    expect(app).not.toContain('className="filter-title">Afficher');
    expect(app.indexOf('className="planning-leave-panel"')).toBeLessThan(
      app.indexOf('className={`month-card'),
    );
  });

  it("compte les jours travaillés jusqu’au 31 décembre dans le calendrier et annonce le prochain mécénat ou heures sup", () => {
    const home = readFileSync(new URL("./src/HomeDashboard.tsx", import.meta.url), "utf8");
    // La case garde le mois affiché ; son volet donne le reste de l'année.
    expect(planningCommandCenter).toContain("travaillé{s(workedDays.month.worked)} ce mois-ci");
    expect(planningCommandCenter).toContain("D’ici au 31 décembre");
    expect(planningCommandCenter).not.toContain("workedDays.thirds");
    // L'accueil remplace « Travail restant » par le prochain mécénat ou heures sup.
    expect(home).not.toContain("today-remaining-work");
    expect(home).toContain('className="today-block today-next-extra"');
    expect(app).toContain("nextExtraWork");
  });

  it("donne à Congés et récupérations les bleus de son ancienne œuvre", () => {
    expect(app).toContain('homeSection === "leave"');
    expect(appNavigation).toContain('`top-header top-header-${section}`');
    expect(headers.anyRuleDeclares(":root .app-shell .top-header-leave", { "--header-a": "#0e2e41" })).toBe(true);
  });

  it("organise l’accueil de Ma paie autour du mois et des accès directs", () => {
    expect(payDashboard).toContain('className="pay-bulletin-month"');
    expect(payDashboard).toContain("Net estimé");
    expect(payDashboard).toContain("Détail du calcul");
    expect(payDashboard).not.toContain("Actions utiles");
    expect(payDashboard).not.toContain("pay-dashboard-checks");
    expect(appRoot).not.toContain("Bulletin du mois non vérifié");
    expect(appRoot).not.toContain('actionLabel: "Choisir le PDF"');
    expect(payDashboard).toContain("Primes et jours fériés");
    expect(payDashboard).toContain("Vérifier mon bulletin");
    expect(payDashboard).toContain("Affiner les valeurs manuellement si besoin");
    expect(css.mentions(".pay-bulletin .pay-bulletin-layout")).toBe(true);
    expect(css.mentions(".pay-dashboard-settings")).toBe(true);
  });

  it("présente les téléchargements PDF en une ligne de réglages puis une liste de documents", () => {
    expect(app).toContain('className="pdf-quick-settings"');
    expect(app).toContain('className="pdf-doc-grid"');
    expect(app).toContain('className="pdf-doc-download"');
    expect(app).toContain('className="pdf-doc-pages"');
    expect(app).not.toContain('className="pdf-preparation-panel"');
    expect(app).not.toContain('className="pdf-step-number"');
  });

  it("donne à Ma paie les couleurs de son ancienne œuvre", () => {
    expect(app).toContain('homeSection === "pay"');
    expect(appNavigation).toContain('`top-header top-header-${section}`');
    expect(headers.anyRuleDeclares(":root .app-shell .top-header-pay", { "--header-a": "#1c2a50" })).toBe(true);
  });

  it("réserve la galerie multicolore à l’en-tête des PDF", () => {
    expect(app).toContain('homeSection === "pdf"');
    expect(appNavigation).toContain('`top-header top-header-${section}`');
    expect(css.hasRule(".top-header.top-header-pdf")).toBe(true);
    expect(css.usesValue("url(\"/pdf-header-art-fast.webp\")")).toBe(true);
    expect(css.usesValue("url(\"/pdf-header-art-fast.webp\") center 70% / cover no-repeat")).toBe(true);
  });

  it("garde toutes les fenêtres au-dessus de l’en-tête fixe", () => {
    expect(css.declares("z-index", "1250")).toBe(true);
    expect(css.declares("z-index", "1000")).toBe(true);
  });
});
