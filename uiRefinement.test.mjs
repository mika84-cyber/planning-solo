import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
const payslipCalibrationCard = readFileSync(new URL("./src/PayslipCalibrationCard.tsx", import.meta.url), "utf8");
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
const app = [appRoot, appNavigation, homeDashboard, payPage, payDashboard, payAllowancesSection, pdfDownloadPage, leaveManagementPage, planningCommandCenter, schoolVacationUi, planningDayCell, usefulResourcesHub, payslipCheckSection, payslipCalibrationCard, appDialogLayer, dayDetailDialog, balanceDetailDialog, requestSelectionPanel, planningRequestPanels, annualPdfActions, payContent, payAllowances, leaveStats, todayOverview, upcomingNoteList, profileAdjustmentActions, grandPalaisProgramData, workTimeActions, payActions, authenticationActions, accountDataActions, planningEntryActions].join("\n");
const stylesheetEntry = readFileSync(new URL("./src/styles.css", import.meta.url), "utf8");
const importedStyles = [...stylesheetEntry.matchAll(/@import\s+"([^"]+)"/g)]
  .map(([, relativePath]) =>
    readFileSync(
      new URL(`./src/${relativePath.replace(/^\.\//, "")}`, import.meta.url),
      "utf8",
    ),
  );
const styles = [
  stylesheetEntry,
  ...importedStyles,
  readFileSync(new URL("./src/grandPalaisProgram.css", import.meta.url), "utf8"),
].join("\n");
const model = readFileSync(new URL("./src/appModel.ts", import.meta.url), "utf8");
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
    expect(styles).not.toMatch(/\.install-app-button\s*\{[^}]*position:\s*fixed/s);
  });

  it("diffère les pages secondaires et met le profil de paie en avant", () => {
    expect(appSections).toContain('import("./PayPage").then');
    expect(appSections).toContain('import("./PayEstimateDetails").then');
    expect(appSections).toContain('import("./ColleaguePlanningPage").then');
    expect(appSections).not.toContain('const payPageModule = import("./PayPage")');
    expect(styles).toContain(".pay-app-screen:has(.pay-dashboard)");
    expect(styles).toContain("animation: none;");
    expect(styles).toContain(".pay-dashboard-profile-slot .pay-profile-symbol");
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
    expect(styles).toContain(".cet-toolbar .secondary-button");
    expect(styles).toContain("background: #fff;");
    expect(workTimeDialogs).toContain("Heures à poser");
    expect(app).toContain("Heures à poser pour chaque date");
    expect(styles).toContain(".recovery-duration-field .recovery-duration-choice button.active");
  });

  it("affiche le CET en rubrique ouverte et distingue la rubrique Autre", () => {
    expect(styles).toContain(".cet-section-static");
    expect(styles).toContain("border-left: 6px solid #6c61b8");
    expect(app).toContain('<strong id="leave-request-archive-title">Demandes archivées</strong>');
    expect(cetSection).toContain('className="cet-section open cet-section-static"');
    expect(cetSection).toContain("alimentation du 15 novembre au 31 décembre");
    expect(cetSection).not.toContain("setOpen");
    expect(cetSection).not.toContain("Planning Solo vous aide à suivre et simuler votre CET");
    expect(cetSection).toContain('placeholder="0" value={initialBalanceInput}');
    expect(cetSection).toContain('setInitialBalanceInput(value)');
    expect(styles).toContain(".leave-request-archive .request-archive-icon");
  });

  it("conserve le profil et la période de paie repliables", () => {
    expect(app).toContain('className="pay-profile-summary"');
    expect(app).toContain("aria-expanded={profileOpen}");
    expect(app).toContain('className="pay-period-toggle"');
    expect(app).toContain("aria-expanded={payPeriodOpen}");
  });

  it("anime le changement de mois sans gêner le défilement vertical", () => {
    expect(styles).toContain("touch-action: pan-y");
    expect(styles).toContain("@keyframes pay-month-out-left");
    expect(styles).toContain("@keyframes pay-month-in-right");
    expect(app).toContain("slideAllowancesMonth(deltaX < 0 ? 1 : -1)");
  });

  it("organise les cartes et commandes du planning pour le téléphone", () => {
    expect(styles).toContain('"today next"');
    expect(styles).toContain('"leave remaining"');
    expect(styles).not.toContain("today-group-card");
    expect(styles).toContain(".controls .worked-days { grid-column: 1");
    expect(styles).toContain(".controls .planning-group-choice { grid-column: 2");
    expect(styles).toContain(".controls > .planning-leave-mobile { grid-column: 1 / -1");
    expect(styles).toContain(".calendar-toolbar.month-toolbar .today-button");
    expect(app).toContain("planning-workspace-shell");
  });

  it("affiche ASA, garde d’enfant, maladie et les deux moitiés de congé", () => {
    expect(app).toContain('myLeaveType === "exceptional"');
    expect(app).toContain('myLeaveType === "childcare"');
    expect(app).toContain('myLeaveType === "sick"');
    expect(app).toContain('myLeaveType === "sick" ? "🤒"');
    expect(styles).toContain(".day.leave-day.leave-exceptional");
    expect(styles).toContain(".day.leave-day.leave-childcare");
    expect(styles).toContain(".day.leave-day.leave-sick");
    expect(styles).toContain(".day.half-morning::after");
    expect(styles).toContain("border-right: 1px solid #000");
    expect(styles).toContain("border-left: 1px solid #000");
    expect(styles).toContain("box-shadow: inset 0 0 0 2px #000");
    expect(styles).toContain("box-sizing: border-box");
    expect(styles).toContain("left: 0");
  });

  it("compacte les quatre cartes mobiles sans icônes", () => {
    expect(styles).toContain("grid-auto-rows: 84px");
    expect(styles).toContain(".today-overview-grid .today-card-icon { display: none !important; }");
    expect(app).toContain("Congés restants");
  });

  it("mène chaque information manquante à l’endroit exact où elle se saisit", () => {
    // Chaque invitation ouvre son écran et descend jusqu'au bon bloc : la
    // liste des fériés, l'ajout d'un bulletin. Arriver en haut de la page
    // laisserait chercher.
    expect(app).toContain("Compléter votre profil de calcul");
    expect(app).toContain("Choisir la prime de ${missingHolidayChoices} jour");
    expect(app).toContain("Ajouter un bulletin de paie");
    expect(app).toContain('scrollWhenReady("holiday-choices")');
    expect(app).toContain('scrollWhenReady("pay-dashboard-verification")');
    expect(app).toContain('id="holiday-choices"');
    expect(app).not.toContain("className=\"important-alert\"");
    // Un dimanche reporté se règle seul : il ne réclame rien à personne.
    expect(app).not.toContain("dimanche${s(sundayCarryover)} travaillé");
  });

  it("actualise les libellés demandés dans les primes", () => {
    expect(app).toContain("Primes pour le mois");
    expect(app).toContain("Jours fériés dans l’année");
    expect(app).not.toContain('className="step-label">Période de paie');
    expect(app).not.toContain("Jours fériés concernés");
  });

  it("tient la barre de navigation dans la palette et marque la rubrique courante", () => {
    // Elle était le seul élément froid d’une application chaude, avec des
    // couleurs écrites en dur : elle se lisait comme un bandeau rapporté.
    expect(styles).not.toContain("#e4ecf7");
    expect(styles).not.toContain("#304f79");
    expect(styles).not.toContain("#4c5e76");
    expect(styles).toContain(".mobile-bottom-navigation button.active { background: var(--accent-soft); color: var(--accent-strong)");
    // La couleur seule ne suffisait pas : les deux teintes se ressemblaient.
    expect(styles).toContain(".desktop-side-navigation button.active { font-weight: 880; }");
    expect(styles).toContain(".desktop-side-navigation button.active svg { stroke-width: 2.2; }");
  });

  it("rend la navigation mensuelle des primes confortable sur téléphone", () => {
    expect(app).toContain('className="pay-period-month"');
    expect(styles).toContain(".variable-pay-card .pay-month-nav.compact .pay-nav-arrow {");
    expect(styles).toContain("position: absolute;");
    expect(styles).toContain("width: 44px;");
    expect(styles).toContain("right: 60px;");
    expect(app).toContain('className="pay-period-chevron"');
    expect(styles).toContain(".variable-pay-card .pay-period-chevron {");
  });

  it("propose l’arrêt maladie séparément et le retire du congé professionnel", () => {
    expect(app).toContain("Maladie");
    expect(app).toContain('onChoose("leave", "sick")');
    expect(app).toContain('dayLeaveType === "sick"');
    expect(app).toContain("saveSickDateDirect(date)");
    expect(app).toContain("prepareAbsenceReplacement");
    expect(planningRequestActions).toContain("prepareAbsenceReplacement");
    expect(absenceReplacement).toMatch(
      /AUTOMATICALLY_REFUNDED_TYPES\s*=\s*new Set<LeaveType>\(\[\s*"annual",\s*"half",?\s*\]\)/,
    );
    // La retenue maladie s'applique désormais aux deux statuts : un bulletin
    // réel de contractuel déduit bien le jour de carence (voir
    // src/payMonth.test.ts). L'ancienne mention « impact à vérifier », qui
    // masquait le montant aux contractuels, ne doit pas revenir.
    expect(app).toContain('detail: "carence et retenue de 10 %"');
    expect(app).not.toContain("impact à vérifier selon le maintien de salaire");
  });

  it("indique le groupe réellement présent avec l’utilisatrice aujourd’hui", () => {
    expect(app).toContain("coWorkingGroups");
    expect(app).toContain("coWorkingGroupsForDate(today, group)");
    expect(app).toContain("avec le groupe ${coWorkingGroups[0]}");
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
    expect(app).toContain('profileOpen ? "Replier" : netEstimateComplete ? "Profil complet" : "À compléter"');
    expect((payDashboard.match(/className="pay-today-button"/g) || []).length).toBe(1);
    expect((payEstimateDetails.match(/className="pay-today-button"/g) || []).length).toBe(1);
    expect(app).toContain("Aucun dimanche versé sur cette paie");
    expect(styles).toContain(".pay-detail-sticky-header");
    expect(styles).toContain("position: sticky");
  });

  it("rend toute la zone de titre refermable et garde le mois dans la barre sticky", () => {
    expect(app).toContain('className="pay-detail-title-button"');
    expect(app).toContain('aria-label="Fermer cette page et revenir à Ma paie"');
    expect(app).toContain("MONTHS[view.getMonth()]");
    expect(styles).toContain(".pay-detail-title-button");
  });

  it("affiche l’état du profil dans son action et agrandit le calendrier mobile", () => {
    expect(app).toContain('pay-profile-open-copy${netEstimateComplete ? " complete" : " missing"}');
    expect(app).not.toContain('"Informations manquantes"');
    expect(styles).toContain(".pay-profile-open-copy.complete");
    expect(styles).toContain("min-height: 54px");
  });

  it("laisse la quotité et le statut vides tant qu’ils n’ont pas été choisis", () => {
    // Les calculs retiennent bien un temps plein contractuel par défaut,
    // mais l’afficher ferait passer pour renseigné ce qui reste à décider.
    expect(appRoot).toContain("workQuota={formProfile?.workQuota}");
    expect(appRoot).toContain("status={formProfile?.status}");
    expect(payPage).toContain('placeholder="À renseigner"');
    expect(payPage).toContain("Quotité et statut à renseigner");
    expect(payPage).not.toContain('status={formProfile?.status || "contractuel"}');
    expect(styles).toContain(".choice-picker-trigger.empty");
  });

  it("n'affiche aucun brut trompeur tant que le profil de paie est incomplet", () => {
    expect(payEstimateDetails).toContain("euros(grossEstimateComplete ? gross : 0)");
  });

  it("enregistre plusieurs congés dans un lot idempotent unique", () => {
    expect(app).toContain("postCalendarPeriodsVerified");
    expect(calendarApi).toContain('action: "save-periods"');
    expect(calendarApi).toContain("postCalendarIdempotent");
  });

  it("compte Divers comme jour non travaillé et permet les suppressions multiples", () => {
    expect(app).toContain("Jour non travaillé dans le planning");
    expect(app).toContain('period.leaveType === "recovery"');
    expect(calendarCleanup).toContain("Effacer plusieurs dates ou notes");
    expect(app).toContain('className="holiday-pay-amount"');
  });

  it("ajoute Divers directement au planning avec une punaise inclinée", () => {
    expect(app).toContain('onChoose("other", "other")');
    expect(app).toContain("saveOtherDateDirect(dayDate)");
    expect(app).toContain('persistSingleDayPeriod(date, "other")');
    expect(app).not.toContain('openPlanningRequestMethod("other"');
    expect(styles).toContain("transform: rotate(24deg)");
    expect(styles).toContain(".other-pin-head");
    expect(styles).toContain(".other-pin-needle");
    expect(styles).toContain(".day.leave-day.leave-other,");
    expect(styles).toContain("outline: 2px solid #000");
  });

  it("colore l’action de suppression multiple", () => {
    expect(styles).toContain(".calendar-toolbar.month-toolbar .calendar-bulk-delete-mobile {");
    expect(styles).toContain("background: #f8faff");
    expect(styles).toContain("color: #a9243a");
  });

  it("sépare chaque catégorie de solde entre congés pris et à venir", () => {
    expect(app).toContain("balanceDetailPeriods");
    expect(app).toContain('key: "taken"');
    expect(app).toContain('key: "upcoming"');
    expect(app).toContain('className="balance-detail-months"');
    expect(app).toContain("balance-detail-${period.key}");
    expect(app).toContain("period.units.toLocaleString");
    expect(app).toContain("Aucun congé dans cette rubrique");
    expect(styles).toContain(".balance-detail-month > summary");
    expect(styles).toContain(".balance-detail-month[open]");
  });

  it("garde l’effacement multiple sur une seule ligne", () => {
    expect(styles).toContain(".calendar-toolbar.month-toolbar .calendar-bulk-delete-mobile {");
    expect(styles).toContain("white-space: nowrap");
    expect(styles).toContain("font-size: 10.5px");
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
    expect(app).toContain('className={`app-update-button');
    expect(app).toContain("Vérifier les mises à jour");
    expect(app).toContain("Une mise à jour est disponible");
    expect(app).toContain("planning-app-update-available");
    expect(main).toContain('registration.addEventListener("updatefound"');
    expect(main).toContain("2 * 60 * 1000");
    expect(app).toContain("<AppUpdateDialog");
    expect(planningDialogs).toContain("Mettre à jour maintenant");
    expect(planningDialogs).toContain('className="save-button update-now-button"');
    expect(planningDialogs).toContain("La page ne sera actualisée qu’après votre confirmation");
    expect(styles).toContain(".app-update-button");
    expect(styles).toContain(".update-available-modal .update-now-button");
    expect(styles).toContain("background: #c52f42");
  });

  it("affiche Divers en rose sans pastille dans le choix des absences", () => {
    expect(app).not.toContain('className="other-choice-dot"');
    expect(styles).toContain("background: #fff1f5 !important");
    expect(styles).toContain("--person-color: #e58aa5");
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
    expect(styles).toContain(".calendar-delete-actions .delete-absences-button,\n.calendar-delete-actions .delete-notes-button");
    expect(styles).toContain("min-height: 46px");
  });

  it("aligne Aujourd’hui et le nettoyage sur la même rangée mobile", () => {
    expect(styles).toContain(".calendar-toolbar.month-toolbar .today-button");
    expect(styles).toContain(".calendar-toolbar.month-toolbar .calendar-bulk-delete-mobile");
    expect(styles).toContain("grid-row: 2");
  });

  it("garde les détails des jours travaillés dans l’écran", () => {
    expect(styles).toContain(".worked-days-panel {\n    right: auto;\n    left: 0;");
    expect(styles).toContain("width: min(400px, calc(100vw - 52px))");
    expect(styles).toContain("max-height: min(58dvh, 420px)");
  });

  it("affiche Divers en rose avec une punaise rouge", () => {
    expect(app).toContain('personalDay ? " personal-day" : ""');
    expect(app).toContain('className={`other-pin${compact ? " compact" : ""}`}');
    expect(styles).toContain(".leave-day.leave-other,\n.day.personal-day,");
    expect(styles).toContain("color: #d51f3b");
    expect(styles).toContain("background: #f4b8c8 !important");
  });

  it("compacte le montant des fériés choisis et espace la navigation de paie", () => {
    expect(payAllowancesSection).toContain('className="holiday-pay-amount"');
    expect((payAllowancesSection.match(/holidayChoice\(item\)/g) || []).length).toBe(2);
    expect(payEstimateDetails).toContain('className="pay-month-nav compact pay-detail-month-nav"');
    expect(styles).toContain(".holiday-pay-amount {\n  width: fit-content;");
    expect(styles).toContain("grid-template-columns: 36px 36px");
    expect(styles).toContain("gap: 8px 12px");
  });

  it("donne le même liseré aux tableaux Planning et Couleurs des deux PDF", () => {
    expect(planningPdf).toContain("const panelBorderWidth = 0.42");
    expect((planningPdf.match(/setLineWidth\(panelBorderWidth\)/g) || []).length).toBe(4);
  });

  it("réunit la préparation puis propose formulaire ou enregistrement direct", () => {
    expect(app).toContain('openRequestChooser("planning", date)');
    expect(app).toContain('openPlanningRequestMethod("recovery", dayDate)');
    expect(planningLogic).toContain('"recovery_day",');
    expect(planningLogic).toContain('"recovery_half",');
    expect(planningLogic).toContain('"recovery_hours",');
    expect(planningLogic).toContain('"recovery_holiday",');
    expect(planningLogic).toContain('"recovery_training",');
    expect(app).toContain("Enregistrer et préparer le formulaire");
    expect(app).toContain("Enregistrer uniquement");
    expect(app).toContain("Le formulaire est préparé, mais jamais envoyé automatiquement");
    expect(app).toContain("Vous pouvez mélanger plusieurs types dans une même demande.");
    expect(app).toContain("Étape 2 sur 3 · Choisissez les dates");
    expect(app).toContain("Autres types de congé");
    expect(app).toContain('role="tablist" aria-label="Contenu de la journée"');
    expect(app).toContain('role="tabpanel" aria-labelledby="day-leave-tab"');
    expect(app).toContain('aria-labelledby={quickNoteMode ? undefined : "day-notes-tab"}');
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
    expect(styles).toContain(".holiday-pay-picker .choice-picker-menu");
    expect(styles).toContain("bottom: calc(100% + 7px)");
  });

  it("distingue la zone du planning mensuel du tableau toutes zones du PDF", () => {
    expect(pdfDownloadPage).not.toContain("schoolVacationZone");
    expect(pdfDownloadPage).toContain("Cocher la case pour intégrer les vacances scolaires au planning");
    expect(schoolVacationUi).toContain("SCHOOL_ZONE_OPTIONS");
    expect(schoolVacationUi).toContain("Zone scolaire affichée");
  });

  it("équilibre les commandes du planning sur grand écran", () => {
    expect(styles).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    // La vue annuelle a été retirée : c'est la barre du mois qui se répartit
    // désormais, et plus la barre de l'année.
    expect(styles).not.toContain("annual-toolbar");
    expect(styles).toContain(".calendar-toolbar.month-toolbar .period-navigation");
    expect(styles).toContain("grid-column: 1 / -1");
  });

  it("rend les cartes du tableau de bord de paie et les dernières absences immédiatement repérables", () => {
    expect(styles).toContain(".pay-dashboard-priority-grid");
    expect(styles).toContain("border: 1px solid var(--border-card)");
    expect(app).toContain("recentBalanceDetailDates.has(detail.date)");
    expect(styles).toContain(".recent-leave-date");
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
    expect(styles).toContain(".planning-group-action-row .choice-picker");
    expect(styles).toContain(".leave-request-archive");
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
    expect(styles).toContain(".manual-adjustments-modal");
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
    expect(styles).toContain(".period-direct-actions");
  });

  it("affiche un résumé des dates avant la validation", () => {
    expect(app).toContain("<RequestValidationSummary");
    expect(requestValidationSummary).toContain("Résumé avant validation");
    expect(requestValidationSummary).toContain("Effet de la validation");
  });

  it("réserve le menu principal au compte et aux réglages", () => {
    expect(appNavigation).toContain("Compte et réglages");
    expect(appNavigation).toContain("Vérifier les mises à jour");
    expect(appNavigation).toContain("Mes données");
    expect(appNavigation).toContain("Écrire à l’administrateur");
    expect(appNavigation).not.toContain('const MENU_ITEMS');
    expect(appNavigation).not.toContain("Mode d’emploi");
    expect(appRoot).toContain("<UsefulResourcesHub");
    expect(appRoot).toContain("pdf={(");
    expect(usefulResourcesHub).toContain('key: "pdf"');
    expect(usefulResourcesHub).toContain("useful-resources-screen");
    expect(app).not.toContain("Sauvegarde et restauration");
    expect(styles).toContain(".main-menu-secondary .guide-menu-entry");
    expect(styles).toContain('url("/menu-art-fast.webp")');
    expect(styles).toContain("background: linear-gradient(90deg, #101c27, rgba(5, 11, 19, 0.82) 65%, transparent)");
    expect(app).toContain('className="main-menu-index"');
    expect(app).toContain('className="main-menu-chevron"');
    expect(app).toContain("header-command-area");
    expect(app).toContain("header-update-button");
    expect(styles).toContain(".header-update-button");
    expect(styles).toContain("width: fit-content");
    expect(styles).toContain("min-height: 32px");
    expect(styles).toContain("font-size: 10px");
    expect(app).not.toContain("menu-update-button");
  });

  it("aère l’arrêt maladie", () => {
    expect(app).toContain("sick-request-panel");
    expect(styles).toContain(".sick-request-options .request-option-group");
    expect(styles).toContain("grid-template-columns: minmax(180px, 0.62fr) minmax(240px, 1.38fr)");
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
    expect(styles).toContain('url("/header-art-fast.webp")');
    expect(styles).toContain("rgba(255, 249, 232, 0.62)");
    expect(styles).toContain("rgba(244, 250, 252, 0.3)");
    expect(styles).toContain("border-color: rgba(0, 0, 0, 0.65)");
  });

  it("uniformise exactement les en-têtes sur le gabarit Formulaires utiles", () => {
    expect(styles).toContain("height: 205px;\n  min-height: 205px;");
    expect(styles).toContain("height: 215px;\n    min-height: 215px;");
    expect(styles).toContain("left: 29%;");
    expect(styles).toContain("border: 1.5px solid rgba(48, 87, 126, 0.42)");
  });

  it("ne conserve que les fonds illustrés de l’en-tête et du menu", () => {
    expect(app).toContain('className="app-shell"');
    expect(styles).toContain('url("/header-art-fast.webp")');
    expect(styles).toContain('url("/menu-art-fast.webp")');
    expect(styles).toContain('url("/forms-header-art-fast.webp")');
    expect(styles).not.toContain("/home-art.jpg");
    expect(styles).not.toContain("/leave-art.jpg");
    expect(styles).not.toContain("/pay-art.jpg");
    expect(styles).not.toContain("/pdf-art.jpg");
  });

  it("permet de balayer les rubriques principales sur téléphone", () => {
    expect(appNavigation).toContain("export const MAIN_SECTION_ORDER");
    for (const section of ["home", "leave", "pay", "pdf", "program", "forms", "colleagues"])
      expect(appNavigation).toContain(`"${section}"`);
    expect(app).toContain("onTouchStart={startSectionSwipe}");
    expect(app).toContain("onTouchEnd={finishSectionSwipe}");
    expect(app).toContain("Math.abs(deltaX) < 48");
  });

  it("retire le mode sombre et réduit le téléchargement des formulaires à son icône", () => {
    expect(app).not.toContain("ThemePreferenceControl");
    expect(main).not.toContain("applyInitialTheme");
    expect(styles).not.toContain('html[data-theme="dark"]');
    expect(styles).toContain(".useful-form-download-label");
    expect(styles).toContain("width: 42px;\n  height: 42px;");
  });

  it("renforce la lisibilité du menu et les contours de l’en-tête", () => {
    expect(styles).toContain(".main-menu-copy strong { color: #fff; }");
    expect(styles).toContain(".main-menu-copy small {\n  color: rgba(239, 246, 255, 0.78);");
    expect(styles).toContain("backdrop-filter: saturate(1.08) contrast(1.02)");
    expect(styles).toContain(".top-header .account-button,");
    expect(styles).toContain("border: 1.5px solid rgba(0, 0, 0, 0.62)");
  });

  it("centre l’image de chargement sur téléphone", () => {
    expect(styles).toContain(".auth-splash-image {\n    object-fit: cover;\n    object-position: 46% 50%;");
  });

  it("dessine un liseré noir autour des en-têtes et de leurs onglets", () => {
    expect(styles).toContain("border-color: rgba(0, 0, 0, 0.65)");
    // La bascule Mois / Année a été retirée : ce sont les trois commandes
    // restantes de l'en-tête qui portent ce liseré sur les œuvres colorées.
    expect(styles).not.toContain("view-switch");
    expect(styles).toContain(".top-header .header-update-button {\n  border: 1.5px solid rgba(0, 0, 0, 0.62)");
  });

  it("harmonise les cadres principaux et secondaires de l’application", () => {
    expect(styles).toContain("--app-frame-strong");
    expect(styles).toContain("--app-frame-soft");
    expect(styles).toContain(".cet-subsection,");
    expect(styles).toContain(".leave-balance-grid button,");
    expect(styles).toContain(".request-option-group,");
  });

  it("aligne Divers avec Grève sur les grands écrans et décale l’œuvre sur Z Fold ouvert", () => {
    expect(styles).toContain("@media (min-width: 721px) {");
    expect(styles).toContain(".leave-balances-direct .leave-balance-grid button.other {\n    grid-column: auto;\n    order: 1;");
    expect(styles).toContain(".leave-balances-direct .leave-balance-grid button.strike { order: 2; }");
    expect(styles).toContain(".leave-balances-direct .leave-balance-grid button.cet { order: 3; }");
    expect(styles).toContain("left: 53%;");
  });

  it("renforce la lisibilité des soldes sans retirer leurs couleurs", () => {
    expect(styles).toContain("color-mix(in srgb, var(--balance-color) 58%, #17243a)");
    expect(styles).toContain(".leave-balances-direct .leave-balance-grid small {\n  color: #4b596d;");
    expect(styles).toContain("border: 1px solid color-mix(in srgb, var(--balance-color) 52%, #aeb9c7)");
  });

  it("élargit uniquement l’en-tête sur les grands écrans", () => {
    expect(styles).toContain("@media (min-width: 1200px)");
    expect(styles).toContain("width: calc(100% + 64px)");
    expect(styles).toContain("margin-left: -32px");
  });

  it("aligne l’action contextuelle en haut à droite de l’encadré Aujourd’hui", () => {
    expect(styles).toContain(".today-overview-heading {\n  align-items: flex-start;");
    expect(styles).toContain(".today-overview-heading .add-action {\n  align-self: flex-start;");
  });

  it("place le choix du groupe dans Aujourd’hui et la pose de congé avant le mois", () => {
    expect(app).toContain('className="primary-action add-action group-heading-action"');
    expect(app).toContain('`Je suis groupe ${group}`');
    expect(app).not.toContain('className="today-group-card"');
    expect(app).toContain("primary-action planning-leave-action");
    expect(app).toContain('className="planning-leave-panel"');
    expect(styles).toContain(".planning-leave-panel .planning-leave-action {");
    expect(styles).toContain("width: 100% !important;");
  });

  it("retire les filtres Afficher et place la pose de congé contre le calendrier", () => {
    expect(app).not.toContain('className="shared-tools"');
    expect(app).not.toContain('className="filter-title">Afficher');
    expect(app.indexOf('className="planning-leave-panel"')).toBeLessThan(
      app.indexOf('className={`month-card'),
    );
  });

  it("affiche le travail restant de l’année à côté des congés", () => {
    expect(app).toContain("remainingWorkedDaysThisYear");
    expect(app).toContain('className="today-remaining-work"');
    expect(app).toContain("D’ici au 31 décembre");
    expect(styles).toContain('grid-template-areas: "today next" "leave remaining";');
  });

  it("réserve l’œuvre bleue à l’en-tête Congés et récupérations", () => {
    expect(app).toContain('homeSection === "leave"');
    expect(appNavigation).toContain('`top-header top-header-${section}`');
    expect(styles).toContain(".top-header.top-header-leave {");
    expect(styles).toContain(".top-header.top-header-leave::before {");
    expect(styles).toContain('url("/leave-header-art-fast.webp")');
    expect(styles).toContain("background-position: 50% 50%;\n  filter: none;\n  transform: none;");
  });

  it("organise l’accueil de Ma paie autour du mois et des accès directs", () => {
    expect(payDashboard).toContain('className="pay-dashboard-month"');
    expect(payDashboard).toContain("Net estimé");
    expect(payDashboard).not.toContain("Actions utiles");
    expect(payDashboard).not.toContain("pay-dashboard-checks");
    expect(appRoot).not.toContain("Bulletin du mois non vérifié");
    expect(appRoot).not.toContain('actionLabel: "Choisir le PDF"');
    expect(payDashboard).toContain("Primes et jours fériés");
    expect(payDashboard).toContain("Vérifier mon bulletin");
    expect(payDashboard).toContain("Réglages et explications");
    expect(styles).toContain(".pay-dashboard-priority-grid");
    expect(styles).toContain(".pay-dashboard-settings");
  });

  it("présente les téléchargements PDF comme un parcours clair en deux étapes", () => {
    expect(app).toContain('className="pdf-preparation-panel"');
    expect(app).toContain('id="pdf-preparation-title">Préparer le planning');
    expect(app).toContain('className="pdf-format-panel"');
    expect(app).toContain('id="pdf-format-title">Choisir le document');
    expect(app).toContain('className="pdf-action-page-count"');
    expect(app).toContain('className="pdf-action-cta"');
    expect(styles).toContain(".pdf-preparation-panel,");
    expect(styles).toContain(".pdf-download-actions .pdf-action.all {");
    expect(styles).toContain(".pdf-download-actions .pdf-action.my-leaves {");
    expect(styles).toContain("@media (min-width: 721px) and (max-width: 1100px) and (pointer: coarse)");
    expect(styles).toContain(".pdf-download-actions .pdf-action-page-count {\n    position: static;");
  });

  it("réserve le dessin aux lignes noires à l’en-tête Ma paie", () => {
    expect(app).toContain('homeSection === "pay"');
    expect(appNavigation).toContain('`top-header top-header-${section}`');
    expect(styles).toContain(".top-header.top-header-pay {");
    expect(styles).toContain('url("/pay-header-art-fast.webp")');
  });

  it("réserve la galerie multicolore à l’en-tête des PDF", () => {
    expect(app).toContain('homeSection === "pdf"');
    expect(appNavigation).toContain('`top-header top-header-${section}`');
    expect(styles).toContain(".top-header.top-header-pdf {");
    expect(styles).toContain('url("/pdf-header-art-fast.webp")');
    expect(styles).toContain('url("/pdf-header-art-fast.webp") center 70% / cover no-repeat');
  });

  it("garde toutes les fenêtres au-dessus de l’en-tête fixe", () => {
    expect(styles).toContain("z-index: 1250");
    expect(styles).toContain("z-index: 1000");
  });
});
