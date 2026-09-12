import type { RefObject } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { grandPalaisExceptionalClosure } from "./grandPalaisClosures";
import type { SharedGrandPalaisEvent } from "./grandPalaisProgramTypes";
import type { usePlanningUiState } from "./usePlanningUiState";
import type {
  Entries,
  LeavePeriod,
  PartnerCalendarEntries,
  SharedEntry,
  WorkExchange,
  RequestKind,
} from "./appModel";
import { HOLIDAY_PAY_OPTIONS, euros, noteDateLabel } from "./appModel";
import { minutesLabel, type RecoveryUse } from "./overtime";
import {
  HALF_MOMENT_OPTIONS,
  LEAVE_TYPE_OPTIONS,
  dateTimeLabel,
  fromKey,
  holidayAllowance,
  leaveTypeLabel,
  longDate,
  periodLabel,
  type LeaveType,
  type SelectionType,
} from "./planningLogic";

/** État de la fiche jour, repris tel quel du magasin de l'écran planning. */
type DayPlanningState = Pick<
  ReturnType<typeof usePlanningUiState>,
  | "dayDate"
  | "setDayDate"
  | "dayPanelTab"
  | "setDayPanelTab"
  | "dayLeave"
  | "setDayLeave"
  | "dayPersonalLeave"
  | "dayWish"
  | "setDayWish"
  | "dayLeaveType"
  | "setDayLeaveType"
  | "dayHalfMoment"
  | "setDayHalfMoment"
  | "dayHolidayPay"
  | "setDayHolidayPay"
  | "setLeaveRangeEnabled"
  | "setLeaveRangeFrom"
  | "setLeaveRangeTo"
  | "savingDay"
  | "setDeletingPeriod"
  | "noteText"
  | "setNoteText"
  | "noteGroupId"
>;

export type DayDetailDialogProps = {
  planning: DayPlanningState;
  quickNoteMode: boolean;
  entries: Entries;
  partnerEntries: PartnerCalendarEntries;
  dayExchange: WorkExchange | null;
  dayStoredPeriods: LeavePeriod[];
  dayRecoveryUses: RecoveryUse[];
  dayExceptionalClosure: boolean;
  dayHolidayChoiceVisible: boolean;
  baseSalary: number;
  approvedGrandPalaisUpdates: SharedGrandPalaisEvent[];
  noteEditorOpen: boolean;
  setNoteEditorOpen: (open: boolean) => void;
  noteFieldRef: RefObject<HTMLTextAreaElement | null>;
  ownNoteAuthorLabel: string;
  editWorkExchange: (exchange: WorkExchange) => void;
  openRequestChooser: (origin?: "general" | "planning", initialDate?: string) => void;
  openPlanningRequestMethod: (
    kind: RequestKind,
    date?: string,
    requestedType?: SelectionType,
  ) => void;
  saveWishDateDirect: (date: string, desired?: boolean) => Promise<void>;
  saveSickDateDirect: (date: string) => Promise<void>;
  saveOtherDateDirect: (date: string) => Promise<void>;
  saveStrikeDateDirect: (date: string) => Promise<void>;
  saveDay: (overrides?: Partial<SharedEntry>) => Promise<void>;
  beginMultipleDateSelectionFromDay: () => void;
  beginNoteDateSelection: () => void;
  editDayLeavePeriod: (period: LeavePeriod) => void;
  deleteRecoveryUse: (entry: RecoveryUse) => Promise<void>;
  deleteAgnesNote: (date: string) => Promise<void>;
  appendNoteLine: () => void;
};

/** Fiche d'une journée : congés et récupérations d'un côté, notes de l'autre. */
export function DayDetailDialog({
  planning,
  quickNoteMode,
  entries,
  partnerEntries,
  dayExchange,
  dayStoredPeriods,
  dayRecoveryUses,
  dayExceptionalClosure,
  dayHolidayChoiceVisible,
  baseSalary,
  approvedGrandPalaisUpdates,
  noteEditorOpen,
  setNoteEditorOpen,
  noteFieldRef,
  ownNoteAuthorLabel,
  editWorkExchange,
  openRequestChooser,
  openPlanningRequestMethod,
  saveWishDateDirect,
  saveSickDateDirect,
  saveOtherDateDirect,
  saveStrikeDateDirect,
  saveDay,
  beginMultipleDateSelectionFromDay,
  beginNoteDateSelection,
  editDayLeavePeriod,
  deleteRecoveryUse,
  deleteAgnesNote,
  appendNoteLine,
}: DayDetailDialogProps) {
  const {
    dayDate,
    setDayDate,
    dayPanelTab,
    setDayPanelTab,
    dayLeave,
    setDayLeave,
    dayPersonalLeave,
    dayWish,
    setDayWish,
    dayLeaveType,
    setDayLeaveType,
    dayHalfMoment,
    setDayHalfMoment,
    dayHolidayPay,
    setDayHolidayPay,
    setLeaveRangeEnabled,
    setLeaveRangeFrom,
    setLeaveRangeTo,
    savingDay,
    setDeletingPeriod,
    noteText,
    setNoteText,
    noteGroupId,
  } = planning;

  if (!dayDate) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && setDayDate(null)
      }
    >
      <section
        className="modal-card note-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-title"
      >
        <button
          className="modal-close"
          type="button"
          onClick={() => setDayDate(null)}
          aria-label="Fermer"
        >
          ×
        </button>
        <span className="step-label">Mon planning</span>
        <h2 id="day-title">
          {quickNoteMode ? "Ajouter une note" : longDate(fromKey(dayDate))}
        </h2>
        {quickNoteMode ? (
          <p>
            Choisissez une date unique ou une période, puis écrivez la note
            qui apparaîtra sur le planning.
          </p>
        ) : (
          <p className="day-modal-prompt">
            Que souhaitez-vous faire pour cette journée&nbsp;?
          </p>
        )}
        {!quickNoteMode ? (
          <div className="day-modal-tabs" role="tablist" aria-label="Contenu de la journée">
            <button id="day-leave-tab" type="button" role="tab" aria-selected={dayPanelTab === "leave"} aria-controls="day-leave-panel" className={dayPanelTab === "leave" ? "active" : ""} onClick={() => setDayPanelTab("leave")}>
              <span className="day-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m8 14 2.2 2.2L16 11"/></svg></span><span className="day-tab-copy"><strong>Congés</strong><small>Poser ou gérer</small></span>
            </button>
            <button id="day-notes-tab" type="button" role="tab" aria-selected={dayPanelTab === "notes"} aria-controls="day-notes-panel" className={dayPanelTab === "notes" ? "active" : ""} onClick={() => setDayPanelTab("notes")}>
              <span className="day-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span className="day-tab-copy"><strong>Notes</strong><small>{entries[dayDate]?.noteText ? "Note enregistrée" : "Ajouter une note"}</small></span>
            </button>
          </div>
        ) : null}
        {!quickNoteMode && (
          <div id="day-leave-panel" className="day-tab-panel day-leave-tab-panel" role="tabpanel" aria-labelledby="day-leave-tab" hidden={dayPanelTab !== "leave"}>
            {dayExchange ? (
              <div className="day-exchange-summary">
                <strong>Échange avec {dayExchange.partnerName} - Groupe {dayExchange.partnerGroup}</strong>
                <span>
                  {dayDate === dayExchange.agreementDate
                    ? `${dayExchange.partnerName} vous remplace ce jour, vous ${colleagueObjectPronoun(dayExchange.partnerName)} remplacez le ${longDate(fromKey(dayExchange.returnDate))}.`
                    : `Vous ${colleagueObjectPronoun(dayExchange.partnerName)} remplacez ce jour, ${dayExchange.partnerName} vous remplace le ${longDate(fromKey(dayExchange.agreementDate))}.`}
                </span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setDayDate(null);
                    editWorkExchange(dayExchange);
                  }}
                >
                  Modifier ou supprimer l’échange
                </button>
              </div>
            ) : null}
            <section className="day-action-section day-action-primary" aria-labelledby="day-leave-actions-title">
              <div className="day-action-section-heading">
                <h3 id="day-leave-actions-title">Congé et récupération</h3>
                <span>Choisissez le parcours adapté</span>
              </div>
              <fieldset className="leave-choices leave-choices-primary" disabled={Boolean(dayExchange)} aria-label="Congé et récupération">
              <button
                    type="button"
                    className={dayLeave ? "leave active" : "leave"}
                    onClick={() => {
                      const date = dayDate;
                      setDayDate(null);
                      openRequestChooser("planning", date);
                    }}
                  >
                    <i />
                    Congé
                    <span>{dayLeave ? "Modifier" : "Choisir"}</span>
                  </button>
                  <button
                    type="button"
                    className="recovery"
                    onClick={() =>
                      openPlanningRequestMethod("recovery", dayDate)
                    }
                  >
                    <i />
                    Récupération
                    <span>Choisir</span>
                  </button>
              </fieldset>
            </section>
            <details className="day-action-section day-action-other">
              <summary><span><strong>Autres</strong><small>Souhait, maladie, CET et situations particulières</small></span><b aria-hidden="true">⌄</b></summary>
              <fieldset className="leave-choices leave-choices-other" disabled={Boolean(dayExchange)} aria-label="Autres actions de la journée">
                  <button
                    type="button"
                    className={dayWish ? "wish active" : "wish"}
                    onClick={() => void saveWishDateDirect(dayDate)}
                    disabled={savingDay}
                  >
                    <i />
                    Congé souhaité
                    <span>{dayWish ? "Ajouté" : "Hors période d’ouverture"}</span>
                  </button>
                  <button
                    type="button"
                    className={
                      dayLeave && dayLeaveType === "sick"
                        ? "sick-day active"
                        : "sick-day"
                    }
                    onClick={() => {
                      const date = dayDate;
                      void saveSickDateDirect(date);
                    }}
                  >
                    <i />
                    Maladie
                    <span>
                      {dayLeave && dayLeaveType === "sick" ? "Sélectionné" : "Ajouter"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={
                      dayLeave && dayLeaveType === "other"
                        ? "other-day active"
                        : "other-day"
                    }
                    onClick={() => void saveOtherDateDirect(dayDate)}
                  >
                    <i />
                    Divers
                    <span>Jour non travaillé</span>
                  </button>
                  <button
                    type="button"
                    className={
                      dayLeave && dayLeaveType === "strike"
                        ? "strike-day active"
                        : "strike-day"
                    }
                    onClick={() => void saveStrikeDateDirect(dayDate)}
                    disabled={savingDay}
                  >
                    <i />
                    Grève
                    <span>Retenue estimée</span>
                  </button>
                  <button
                    type="button"
                    className={dayLeave && dayLeaveType === "cet" ? "cet-day active" : "cet-day"}
                    onClick={() => openPlanningRequestMethod("leave", dayDate, "cet")}
                  >
                    <i />
                    CET
                    <span>{dayLeave && dayLeaveType === "cet" ? "Sélectionné" : "Choisir"}</span>
                  </button>
                  <button
                    type="button"
                    className={
                      dayExceptionalClosure
                        ? "closure-day active"
                        : "closure-day"
                    }
                    onClick={() => {
                      if (!dayDate) return;
                      const automaticClosure = grandPalaisExceptionalClosure(
                        dayDate,
                        approvedGrandPalaisUpdates,
                      );
                      void saveDay({
                        closureOverride: dayExceptionalClosure
                          ? automaticClosure
                            ? "open"
                            : ""
                          : "closed",
                      });
                    }}
                    disabled={savingDay}
                  >
                    <i />
                    Fermeture exceptionnelle
                    <span>
                      {dayExceptionalClosure ? "Retirer CLOSED" : "Ajouter CLOSED"}
                    </span>
                  </button>
              </fieldset>
            </details>
            {entries[dayDate]?.wish &&
              !dayLeave && (
                <div className="wish-decision">
                  <p>
                    Congé souhaité, en attente de validation. Il ne compte
                    pas dans votre solde.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="save-button"
                      onClick={() => {
                        setDayWish(false);
                        setDayLeave(true);
                        setLeaveRangeEnabled(true);
                        setLeaveRangeFrom(dayDate);
                        setLeaveRangeTo(dayDate);
                      }}
                    >
                      Valider ce congé
                    </button>
                    <button
                      type="button"
                      className="warning-button"
                      onClick={() => void saveWishDateDirect(dayDate, false)}
                    >
                      Annuler le souhait
                    </button>
                  </div>
                </div>
              )}
            {dayLeave &&
              (["annual", "half", "rtt", "fraction", "childcare", "exceptional", "cet", "strike"] as LeaveType[]).includes(dayLeaveType) && (
              <div className="leave-type-field">
                <span>Type de congé</span>
                <ChoicePicker
                  value={dayLeaveType}
                  options={LEAVE_TYPE_OPTIONS.filter((option) =>
                    ["annual", "half", "rtt", "fraction", "childcare", "exceptional", "cet", "strike"].includes(option.value),
                  )}
                  onChange={setDayLeaveType}
                  ariaLabel="Sélectionner le type de congé"
                  className="leave-type-picker"
                />
              </div>
            )}
            {dayLeave &&
              dayLeaveType === "half" && (
                <div className="leave-type-field">
                  <span>Moitié de journée</span>
                  <ChoicePicker
                    value={dayHalfMoment}
                    options={HALF_MOMENT_OPTIONS}
                    onChange={setDayHalfMoment}
                    ariaLabel="Choisir le matin ou l’après-midi"
                    className="leave-type-picker"
                  />
                </div>
              )}
            {dayHolidayChoiceVisible && (
              <div className="leave-type-field">
                <span>Férié travaillé — compensation</span>
                <ChoicePicker
                  value={dayHolidayPay}
                  options={HOLIDAY_PAY_OPTIONS}
                  onChange={setDayHolidayPay}
                  ariaLabel="Choisir la compensation du jour férié"
                  className="leave-type-picker"
                  placeholder="À décider"
                />
                <small className="holiday-pay-hint">
                  {dayHolidayPay
                    ? `${euros(holidayAllowance(baseSalary, dayHolidayPay))}${
                        dayHolidayPay === "recovery"
                          ? " et un jour de récupération"
                          : ""
                      }`
                    : baseSalary
                      ? `Prime seule ${euros(holidayAllowance(baseSalary, "prime"))}, avec récup ${euros(holidayAllowance(baseSalary, "recovery"))}.`
                      : "Renseignez votre traitement de base pour voir les montants."}
                </small>
              </div>
            )}
            {(dayLeave || dayPersonalLeave || dayWish) && (
              <div className="leave-range-box">
                <button
                  className="separate-date-button"
                  type="button"
                  onClick={beginMultipleDateSelectionFromDay}
                >
                  <strong>Choisir plusieurs dates</strong>
                  <span>
                    Sélectionnez plusieurs jours, même dans des mois
                    différents
                  </span>
                </button>
              </div>
            )}
            {dayStoredPeriods.length > 0 && (
              <div className="day-stored-periods">
                <strong>Périodes concernant cette date</strong>
                {dayStoredPeriods.map((period) => (
                  <article key={period.id}>
                    <i className="leave" />
                    <span>
                      {periodLabel(period.from, period.to)}
                      <small>{leaveTypeLabel(period.leaveType)}</small>
                    </span>
                    <div className="period-direct-actions" role="group" aria-label={`Gérer ${periodLabel(period.from, period.to)}`}>
                      <button
                        className="period-edit-button"
                        type="button"
                        onClick={() => editDayLeavePeriod(period)}
                      >
                        Modifier
                      </button>
                      <button
                        className="period-delete-button"
                        type="button"
                        onClick={() => {
                          setDayDate(null);
                          setDeletingPeriod(period);
                        }}
                      >
                        {period.leaveType === "strike"
                          ? "Supprimer la grève"
                          : "Annuler le congé"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {dayRecoveryUses.length > 0 && (
              <div className="day-stored-periods day-recovery-details">
                <strong>Récupérations prises ce jour</strong>
                {dayRecoveryUses.map((entry) => (
                  <article key={entry.id}>
                    <i className="recovery" />
                    <span>
                      {entry.kind === "training" ? "Formation" : "Récupération"}
                      <small>{minutesLabel(entry.minutes)} prises sur votre solde</small>
                    </span>
                    <div className="period-direct-actions recovery-direct-actions">
                      <button
                        className="period-delete-button"
                        type="button"
                        onClick={() => void deleteRecoveryUse(entry)}
                      >
                        Effacer la récupération
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role et aria-labelledby sont absents ensemble en mode note rapide ; le linter n'évalue pas le ternaire. */}
        <div id="day-notes-panel" className="day-tab-panel day-notes-tab-panel" role={quickNoteMode ? undefined : "tabpanel"} aria-labelledby={quickNoteMode ? undefined : "day-notes-tab"} hidden={!quickNoteMode && dayPanelTab !== "notes"}>
        <div className="day-notes-editor" role="group" aria-label="Notes de la journée">
          {!quickNoteMode ? <div className="day-notes-section-heading"><h3>Notes</h3><span>Rendez-vous, rappel ou information personnelle</span></div> : null}
          {partnerEntries[dayDate]?.noteAuthor === "agnes" && partnerEntries[dayDate].noteText ? (
            <section
              className="day-author-note day-author-note-agnes"
              style={{ position: "relative", paddingRight: 52 }}
            >
              <strong>Agnès</strong>
              <p>{partnerEntries[dayDate].noteText}</p>
              <button
                className="note-delete-button"
                type="button"
                aria-label={`Supprimer la note d’Agnès du ${noteDateLabel(dayDate)}`}
                title="Supprimer la note d’Agnès"
                onClick={() => void deleteAgnesNote(dayDate)}
              >
                ×
              </button>
            </section>
          ) : null}
          {entries[dayDate]?.noteText && !noteEditorOpen ? (
            <button
              className="day-author-note day-author-note-mika saved-note-card"
              type="button"
              onClick={() => setNoteEditorOpen(true)}
              aria-label={`Modifier la note de ${ownNoteAuthorLabel}`}
            >
              <strong>{ownNoteAuthorLabel}</strong>
              <p>{entries[dayDate].noteText}</p>
            </button>
          ) : (
          <section className="day-author-note day-author-note-mika">
            <div className="note-field-heading">
              <label className="field-label" htmlFor="note-text">
                <strong>{ownNoteAuthorLabel}</strong>
                <span>{quickNoteMode ? "Contenu de la note" : "Rendez-vous ou note"}</span>
              </label>
          {/* Sans note existante, il n'y a rien à compléter : le bouton ne
              sert qu'à ouvrir une ligne sous ce qui est déjà écrit. */}
          {entries[dayDate]?.noteText && (
            <button
              className="add-note-line"
              type="button"
              onClick={appendNoteLine}
            >
              Ajouter une note
            </button>
          )}
            </div>
        {quickNoteMode ? (
          <label className="leave-type-field note-date-direct-choice">
            <span>Date de la note</span>
            <input
              type="date"
              aria-label="Date de la note"
              value={dayDate}
              onChange={(event) => {
                const date = event.target.value;
                if (!date) return;
                setDayDate(date);
                setLeaveRangeFrom(date);
                setLeaveRangeTo(date);
              }}
            />
          </label>
        ) : null}
            <textarea
              id="note-text"
              ref={noteFieldRef}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              maxLength={300}
              placeholder="Ex. Dentiste à 15 h…"
            />
          </section>
          )}
          {entries[dayDate]?.noteText && !noteEditorOpen ? (
            <button
              className="add-note-line saved-note-add-button"
              type="button"
              onClick={appendNoteLine}
            >
              Ajouter une note
            </button>
          ) : null}
        </div>
        <div className="leave-range-box note-date-choice">
          <button
            className="separate-date-button"
            type="button"
            onClick={beginNoteDateSelection}
          >
            <strong>Choisir le ou les jours</strong>
            <span>
              Sélectionnez un seul jour ou plusieurs dates, même dans des
              mois différents
            </span>
          </button>
        </div>
        {entries[dayDate]?.noteText && entries[dayDate].noteUpdatedAt && (
          <p className="note-meta">
            {dateTimeLabel(entries[dayDate].noteUpdatedAt)}
          </p>
        )}
        <p className="note-hint">
          <span className="note-hint-band" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m6 18 1.2-4.3L16.4 4.5l3.1 3.1-9.2 9.2L6 18Z" />
              <path d="m14.8 6.1 3.1 3.1" />
            </svg>
          </span>
          Rouge clair pour votre note, jaune pour une note d’Agnès.
        </p>
        <div className="modal-actions">
          {entries[dayDate]?.noteText && (
            <button
              className="delete-button"
              type="button"
              onClick={() => {
                if (!window.confirm(
                  `Supprimer votre note du ${noteDateLabel(dayDate)}${noteGroupId ? " sur toute sa période" : ""} ?`,
                )) return;
                setNoteText("");
                setNoteEditorOpen(true);
              }}
            >
              {noteGroupId ? "Effacer toute la période" : "Effacer la note"}
            </button>
          )}
          <button
            className="secondary-button"
            type="button"
            onClick={() => setDayDate(null)}
          >
            Annuler
          </button>
          <button
            className="save-button"
            type="button"
            onClick={() => saveDay()}
            disabled={savingDay}
          >
            {savingDay ? "Synchronisation…" : "Enregistrer"}
          </button>
        </div>
        </div>
      </section>
    </div>
  );
}
