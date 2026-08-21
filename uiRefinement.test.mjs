import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./src/App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./src/styles.css", import.meta.url), "utf8");
const model = readFileSync(new URL("./src/appModel.ts", import.meta.url), "utf8");
const calendarApi = readFileSync(new URL("./src/calendarApi.ts", import.meta.url), "utf8");
const planningPdf = readFileSync(new URL("./src/planningPdf.ts", import.meta.url), "utf8");
const leaveForm = readFileSync(new URL("./public/formulaire/index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("./src/main.tsx", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("./public/sw.js", import.meta.url), "utf8");
const calendarCleanup = readFileSync(new URL("./src/CalendarCleanup.tsx", import.meta.url), "utf8");
const leaveBalancesSection = readFileSync(new URL("./src/LeaveBalancesSection.tsx", import.meta.url), "utf8");
const payEstimateDetails = readFileSync(new URL("./src/PayEstimateDetails.tsx", import.meta.url), "utf8");
const leaveDialogs = readFileSync(new URL("./src/LeaveDialogs.tsx", import.meta.url), "utf8");
const workTimeDialogs = readFileSync(new URL("./src/WorkTimeDialogs.tsx", import.meta.url), "utf8");
const requestValidationSummary = readFileSync(new URL("./src/RequestValidationSummary.tsx", import.meta.url), "utf8");

describe("finitions d’interface", () => {
  it("conserve le profil et la période de paie repliables", () => {
    expect(app).toContain('className="pay-profile-summary"');
    expect(app).toContain("aria-expanded={payProfileOpen}");
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
    expect(styles).toContain('"leave group"');
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
    expect(app).toContain('myLeaveType === "sick"\n                  ? "🤒"');
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

  it("compacte les quatre cartes mobiles sans icônes et précise le mois des dimanches", () => {
    expect(styles).toContain("grid-auto-rows: 84px");
    expect(styles).toContain(".today-overview-grid .today-card-icon { display: none !important; }");
    expect(app).toContain("en attente sur la paye");
    expect(app).toContain("MONTHS[sundayCarryoverMonth]");
  });

  it("actualise les libellés demandés dans les primes", () => {
    expect(app).toContain("Primes pour le mois");
    expect(app).toContain("Jours fériés dans l’année");
    expect(app).not.toContain('className="step-label">Période de paie');
    expect(app).not.toContain("Jours fériés concernés");
  });

  it("propose l’arrêt maladie séparément et le retire du congé professionnel", () => {
    expect(app).toContain("Un arrêt maladie");
    expect(app).toContain('beginRequest("leave", undefined, "sick")');
    expect(app).toContain('dayLeaveType === "sick"');
    expect(app).toContain("saveSickDateDirect(date)");
    expect(app).toContain('leaveType: "sick" as const');
    expect(app).toContain("sans diminuer vos droits à congés");
    expect(app).toContain("impact à vérifier selon le maintien de salaire");
  });

  it("indique le groupe réellement présent avec l’utilisatrice aujourd’hui", () => {
    expect(app).toContain("coWorkingGroups");
    expect(app).toContain("coWorkingGroupsForDate(now, group)");
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
    expect(app).toContain('aria-label="Fermer cette catégorie"');
    expect(app).toContain("Faire défiler");
    expect((app.match(/className="pay-today-button"/g) || []).length).toBe(1);
    expect((payEstimateDetails.match(/className="pay-today-button"/g) || []).length).toBe(1);
    expect(app).toContain("Aucun dimanche versé sur cette paie");
    expect(styles).toContain(".pay-detail-sticky-header");
    expect(styles).toContain("position: sticky");
  });

  it("rend toute la zone de titre refermable et garde le mois dans la barre sticky", () => {
    expect(app).toContain('className="pay-detail-title-button"');
    expect(app).toContain('aria-label="Fermer cette catégorie et revenir à Ma paie"');
    expect(app).toContain("MONTHS[view.getMonth()]");
    expect(styles).toContain(".pay-detail-title-button");
  });

  it("affiche uniquement un profil complet et agrandit le calendrier mobile", () => {
    expect(app).toContain("{netEstimateComplete ? (");
    expect(app).not.toContain('"Informations manquantes"');
    expect(styles).toContain(".pay-profile-completeness.complete");
    expect(styles).toContain(".controls .worked-days > .year-choice-label");
    expect(styles).toContain("min-height: 54px");
  });

  it("n'affiche aucun brut trompeur tant que le profil de paie est incomplet", () => {
    expect(payEstimateDetails).toContain("euros(grossEstimateComplete ? gross : 0)");
  });

  it("enregistre plusieurs congés dans un lot idempotent unique", () => {
    expect(app).toContain("postCalendarPeriodsVerified");
    expect(calendarApi).toContain('action: "save-periods"');
    expect(calendarApi).toContain("postCalendarIdempotent");
  });

  it("actualise le mode d’emploi avec la maladie et les horaires supplémentaires", () => {
    expect(app).toContain("Récupération, Arrêt maladie ou Divers");
    expect(app).toContain("il ne diminue pas vos droits à congés");
    expect(app).toContain("avec leurs horaires de début et de fin");
  });

  it("ajoute Divers sans impact et permet les suppressions multiples", () => {
    expect(app).toContain("Visible dans le planning, sans effet sur la paie ni sur vos soldes");
    expect(app).toContain('period.leaveType === "recovery" || period.leaveType === "other"');
    expect(calendarCleanup).toContain("Effacer plusieurs dates ou notes");
    expect(app).toContain('className="holiday-pay-amount"');
  });

  it("ajoute Divers directement au planning avec une punaise inclinée", () => {
    expect(app).toContain('beginRequest("other", undefined, "other")');
    expect(app).toContain("saveOtherDateDirect(dayDate)");
    expect(app).toContain('leaveType: "other" as const');
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

  it("regroupe chaque catégorie de solde par mois", () => {
    expect(app).toContain("balanceDetailMonths");
    expect(app).toContain("const months = MONTHS.map");
    expect(app).toContain('className="balance-detail-months"');
    expect(app).toContain('className="balance-detail-month"');
    expect(app).toContain("month.units.toLocaleString");
    expect(app).toContain("Aucune date enregistrée ce mois-ci.");
    expect(styles).toContain(".balance-detail-month > summary");
    expect(styles).toContain(".balance-detail-month[open]");
  });

  it("garde l’effacement multiple sur une seule ligne", () => {
    expect(styles).toContain(".calendar-toolbar.month-toolbar .calendar-bulk-delete-mobile {");
    expect(styles).toContain("white-space: nowrap");
    expect(styles).toContain("font-size: 10.5px");
  });

  it("actualise automatiquement l’application installée", () => {
    expect(main).toContain('updateViaCache: "none"');
    expect(main).toContain('addEventListener("controllerchange"');
    expect(main).toContain("window.location.reload()");
    expect(main).toContain('addEventListener("visibilitychange"');
    expect(main).toContain("registration.update()");
    expect(serviceWorker).toContain('fetch(event.request, { cache: "no-store" })');
    expect(serviceWorker).toContain('event.data?.type === "SKIP_WAITING"');
    expect(app).toContain("checkForAppUpdate");
    expect(app).toContain('className={`app-update-button');
    expect(app).toContain("Vérifier les mises à jour");
    expect(styles).toContain(".app-update-button");
  });

  it("affiche une pastille bleue pour Divers dans le choix des absences", () => {
    expect(app).toContain('className="other-choice-dot"');
    expect(styles).toContain(".other-choice-dot");
    expect(styles).toContain("background: var(--leave)");
    expect(styles).toContain("--person-color: var(--leave)");
    expect(app).toContain("Grève, décharge syndicale, fermeture exceptionnelle");
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
    expect(app).toContain("Voir et gérer cette absence");
    expect(app).toContain("Ouvrez un mois pour consulter les dates enregistrées");
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

  it("affiche Divers en bleu avec une punaise rouge", () => {
    expect(app).toContain('personalDay ? " personal-day" : ""');
    expect(app).toContain('className={`other-pin${compact ? " compact" : ""}`}');
    expect(styles).toContain(".leave-day.leave-other,\n.day.personal-day,");
    expect(styles).toContain("color: #d51f3b");
  });

  it("compacte le montant des fériés choisis et espace la navigation de paie", () => {
    expect((app.match(/className="holiday-pay-amount"/g) || []).length).toBe(2);
    expect(payEstimateDetails).toContain('className="pay-month-nav compact pay-detail-month-nav"');
    expect(styles).toContain(".holiday-pay-amount {\n  width: fit-content;");
    expect(styles).toContain("grid-template-columns: 36px 36px");
    expect(styles).toContain("gap: 8px 12px");
  });

  it("donne le même liseré aux tableaux Planning et Couleurs des deux PDF", () => {
    expect(planningPdf).toContain("const panelBorderWidth = 0.42");
    expect((planningPdf.match(/setLineWidth\(panelBorderWidth\)/g) || []).length).toBe(4);
  });

  it("propose formulaire ou saisie manuelle pour congé et récupération depuis le planning", () => {
    expect(app).toContain('openPlanningRequestMethod("leave", dayDate)');
    expect(app).toContain('openRecoveryTypeChooser("planning", dayDate)');
    expect(app).toContain('"recovery_day",');
    expect(app).toContain('"recovery_half",');
    expect(app).toContain('"recovery_hours",');
    expect(app).toContain('"recovery_holiday",');
    expect(app).toContain('planningRequestMethod === "leave"');
    expect(workTimeDialogs).toContain('["holiday", `Jour férié');
  });

  it("uniformise les libellés de compensation et les sélecteurs mobiles", () => {
    expect(model).toContain('label: "Prime + récup"');
    expect(model).not.toContain("Prime + 1 jour de récup");
    expect(styles).toContain(".holiday-pay-picker .choice-picker-menu");
    expect(styles).toContain("bottom: calc(100% + 7px)");
  });

  it("ne propose plus de zone scolaire unique", () => {
    expect(app).not.toContain("schoolVacationZone");
    expect(app).not.toContain("SCHOOL_ZONE_OPTIONS");
    expect(app).toContain("Les dates des zones A, B et C");
  });

  it("équilibre les commandes du planning sur grand écran", () => {
    expect(styles).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(styles).toContain(".calendar-toolbar.annual-toolbar .planning-leave-annual");
    expect(styles).toContain("grid-column: 1 / -1");
  });

  it("rend les catégories de paie et les dernières absences immédiatement repérables", () => {
    expect(styles).toContain(".pay-category-grid > button");
    expect(styles).toContain("border: 1px solid rgba(20, 24, 29, .88)");
    expect(app).toContain("recentBalanceDetailDates.has(detail.date)");
    expect(styles).toContain(".recent-leave-date");
  });

  it("permet une note multi-jours et un crédit manuel de solidarité", () => {
    expect(app).toContain("Choisir le ou les jours");
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
    expect(leaveBalancesSection).toContain("Choisir l’année des absences");
    expect(leaveDialogs).toContain("Dimanches posés en congé");
    expect(leaveDialogs).toContain("Prime de juillet");
    expect(leaveDialogs).toContain("Prime d’octobre");
    expect(leaveDialogs).toContain("Prime de décembre");
    expect(app).toContain('className="balance-detail-open"');
    expect(app).toContain('className="balance-detail-guidance"');
    expect(app).toContain("manualSundayLeaveJanJun");
    expect(styles).toContain(".manual-adjustments-modal");
  });

  it("propose le mode d’emploi au premier lancement et le conserve dans le menu", () => {
    expect(app).toContain("planning:guide-seen-v1:");
    expect(app).toContain("Souhaitez-vous consulter le mode d’emploi ?");
    expect(app).toContain("Consulter");
    expect(app).toContain("Passer");
    expect(app).toContain("Table des matières du mode d’emploi");
    expect(app).toContain("Mode d’emploi");
    expect(app).toContain("congés validés");
    expect(app).toContain("plusieurs bulletins");
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

  it("place le guide neutre juste après les PDF et illustre le menu", () => {
    expect(app.indexOf("Télécharger les plannings en PDF")).toBeLessThan(
      app.indexOf('className="guide-menu-entry"'),
    );
    expect(app.indexOf('className="guide-menu-entry"')).toBeLessThan(app.indexOf("Sauvegarde et restauration"));
    expect(styles).toContain(".main-menu-drawer nav > button.guide-menu-entry");
    expect(styles).toContain('url("/menu-art.jpg")');
    expect(styles).toContain("background: rgba(255, 255, 255, 0.68)");
    expect(app).toContain("header-command-area");
    expect(app).toContain("header-update-button");
    expect(styles).toContain(".header-update-button");
    expect(app).not.toContain("menu-update-button");
  });

  it("aère l’arrêt maladie et modernise le sélecteur Mois Année", () => {
    expect(app).toContain("sick-request-panel");
    expect(styles).toContain(".sick-request-options .request-option-group");
    expect(styles).toContain("grid-template-columns: minmax(180px, 0.62fr) minmax(240px, 1.38fr)");
    expect(app).toContain('aria-pressed={mode === "month"}');
    expect(styles).toContain(".view-switch button.active");
    expect(styles).toContain("border-width: 1.5px");
  });

  it("intègre l’œuvre en texture discrète dans l’en-tête", () => {
    expect(styles).toContain('url("/header-art.webp")');
    expect(styles).toContain("rgba(248, 251, 255, 0.88)");
    expect(styles).toContain("rgba(230, 241, 253, 0.62)");
  });

  it("intègre une œuvre en fond de Ma paie", () => {
    expect(styles).toContain('url("/pay-art.jpg")');
    expect(styles).toContain("rgba(249, 248, 255, 0.64)");
  });

  it("uniformise l’en-tête et illustre les téléchargements PDF", () => {
    expect(styles).toContain(".top-header { min-height: 153px; }");
    expect(styles).toContain(".top-header { min-height: 195px; }");
    expect(styles).toContain('url("/pdf-art.jpg")');
    expect(styles).toContain(".pdf-download-actions .pdf-action {\n  border: 1.5px solid rgba(31, 35, 40, 0.62)");
  });

  it("affiche un dessin léger uniquement derrière l’accueil", () => {
    expect(app).toContain('className={`app-shell app-shell-${homeSection}`}');
    expect(styles).toContain(".app-shell-home::before");
    expect(styles).toContain('url("/home-art.jpg")');
    expect(styles).toContain("rgba(247, 250, 254, 0.81)");
    expect(styles).toContain(".app-shell-home::before { top: 211px; }");
  });

  it("affiche l’œuvre bleue derrière Congés et récupérations", () => {
    expect(styles).toContain(".app-shell-leave::before");
    expect(styles).toContain('url("/leave-art.jpg")');
    expect(styles).toContain("rgba(244, 249, 255, 0.76)");
  });

  it("garde toutes les fenêtres au-dessus de l’en-tête fixe", () => {
    expect(styles).toContain("z-index: 1250");
    expect(styles).toContain("z-index: 1000");
  });
});
