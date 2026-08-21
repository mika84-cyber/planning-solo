import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./src/App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./src/styles.css", import.meta.url), "utf8");
const model = readFileSync(new URL("./src/appModel.ts", import.meta.url), "utf8");
const calendarApi = readFileSync(new URL("./src/calendarApi.ts", import.meta.url), "utf8");

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
    expect(app).toContain('className="overtime-time-title">Horaires');
    expect(app).not.toContain("Nombre d’heures");
    expect(app).not.toContain('overtimeDraft.inputMode === "duration"');
    expect(app).toContain('inputMode: "range"');
  });

  it("garde le titre des catégories de paie accessible et permet de revenir aujourd’hui", () => {
    expect(app).toContain('className="pay-detail-sticky-header"');
    expect(app).toContain('aria-label="Fermer cette catégorie"');
    expect(app).toContain("Faire défiler");
    expect((app.match(/className="pay-today-button"/g) || []).length).toBe(2);
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
    expect(app).toContain("euros(grossEstimateComplete ? monthPay.gross : 0)");
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
    expect(app).toContain("Effacer plusieurs dates ou notes");
    expect(app).toContain('className="holiday-pay-amount"');
  });

  it("allège l’enregistrement et déplace la gestion d’un congé vers la fiche du jour", () => {
    expect(app).not.toContain("Périodes enregistrées");
    expect(app).not.toContain("balance-multi-delete-toggle");
    expect(app).not.toContain("balance-detail-checkbox");
    expect(app).not.toContain("balance-detail-cancel");
    expect(app).toContain("Voir et gérer cette absence");
    expect(app).toContain("permet ensuite de modifier ou d’annuler le congé");
  });

  it("place les absences avant les notes avec deux actions de même taille", () => {
    expect(app.indexOf("Effacer les absences")).toBeLessThan(app.indexOf("Effacer les notes"));
    expect(styles).toContain(".calendar-delete-actions .delete-absences-button,\n.calendar-delete-actions .delete-notes-button");
    expect(styles).toContain("min-height: 46px");
  });

  it("propose formulaire ou saisie manuelle pour congé et récupération depuis le planning", () => {
    expect(app).toContain('openPlanningRequestMethod("leave", dayDate)');
    expect(app).toContain('openRecoveryTypeChooser("planning", dayDate)');
    expect(app).toContain('"recovery_day",');
    expect(app).toContain('"recovery_half",');
    expect(app).toContain('"recovery_hours",');
    expect(app).toContain('"recovery_holiday",');
    expect(app).toContain('planningRequestMethod === "leave"');
    expect(app).toContain('["holiday", `Jour férié');
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
    expect(app).toContain("Ajouter des heures manuellement");
    expect(app).toContain('createClientId("solidarity")');
    expect(app).toContain('disposition: "recovery"');
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
    expect(app).toContain("Reprendre mes absences précédentes");
    expect(app).toContain("Choisir l’année des absences");
    expect(app).toContain("Dimanches posés en congé");
    expect(app).toContain("Prime de juillet");
    expect(app).toContain("Prime d’octobre");
    expect(app).toContain("Prime de décembre");
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
});
