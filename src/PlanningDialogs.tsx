import { useEffect, useState, type CSSProperties } from "react";
import { rangeKeys, type LeavePeriod } from "./appModel";
import { ClockTimePicker } from "./ClockTimePicker";
import { DEFAULT_WORK_SCHEDULE, workScheduleHalfTimes, type WorkSchedule } from "./overtime";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  fromKey,
  halfBalanceOf,
  longDate,
  periodLabel,
  periodTypeLabel,
  shortDate,
  type SelectionType,
} from "./planningLogic";

export function TimeSelectionDialog({
  date,
  activeType,
  start,
  end,
  workSchedule = DEFAULT_WORK_SCHEDULE,
  onStartChange,
  onEndChange,
  onClose,
  onConfirm,
}: {
  date: string | null;
  activeType: SelectionType;
  start: string;
  end: string;
  workSchedule?: WorkSchedule;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!date) return null;
  const recovery = activeType.startsWith("recovery_");
  const halfDay = activeType === "half";
  // Divers : journée entière par défaut, ou une demi-journée. Sans horaires,
  // c'est la journée entière. Un jour exceptionnel ne se prend qu'en journée.
  const duration = activeType === "other";
  const usualMorning = workScheduleHalfTimes(workSchedule, "morning");
  const usualAfternoon = workScheduleHalfTimes(workSchedule, "afternoon");
  const selectedHalf = start === usualAfternoon.start && end === usualAfternoon.end
    ? "afternoon"
    : "morning";
  const chooseHalf = (moment: "morning" | "afternoon") => {
    const times = moment === "morning" ? usualMorning : usualAfternoon;
    onStartChange(times.start);
    onEndChange(times.end);
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-card time-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">{TYPE_LABELS[activeType]}</span>
        <h2 id="time-title">{recovery ? "Choisissez les horaires" : duration ? "Journée ou demi-journée ?" : halfDay ? "Matin ou après-midi ?" : "Indiquez les horaires"}</h2>
        <p>{longDate(fromKey(date))}</p>
        {duration ? (
          <div className="half-day-moment-picker duration-choice" role="radiogroup" aria-label="Choisir la durée">
            <p>Quelle durée souhaitez-vous poser ?</p>
            <div>
              {([
                ["whole", "●", "Journée entière"],
                ["morning", "☀", "Le matin"],
                ["afternoon", "◐", "L’après-midi"],
              ] as const).map(([choice, icon, label]) => {
                const checked = choice === "whole" ? !start : Boolean(start) && selectedHalf === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className={checked ? "active" : ""}
                    onClick={() => {
                      if (choice !== "whole") return chooseHalf(choice);
                      onStartChange("");
                      onEndChange("");
                    }}
                  >
                    <span className="half-day-icon" aria-hidden="true">{icon}</span>
                    <strong>{label}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ) : halfDay ? (
          <div className="half-day-moment-picker" role="radiogroup" aria-label="Choisir la demi-journée">
            <p>Quelle moitié de journée souhaitez-vous poser ?</p>
            <div>
              <button type="button" role="radio" aria-checked={selectedHalf === "morning"} className={selectedHalf === "morning" ? "active" : ""} onClick={() => chooseHalf("morning")}>
                <span className="half-day-icon" aria-hidden="true">☀</span>
                <strong>Le matin</strong>
                <small>Du début de journée jusqu’à la pause</small>
              </button>
              <button type="button" role="radio" aria-checked={selectedHalf === "afternoon"} className={selectedHalf === "afternoon" ? "active" : ""} onClick={() => chooseHalf("afternoon")}>
                <span className="half-day-icon" aria-hidden="true">◐</span>
                <strong>L’après-midi</strong>
                <small>De la reprise jusqu’à la fin de journée</small>
              </button>
            </div>
          </div>
        ) : <><div className={recovery ? "time-fields recovery-time-fields" : "time-fields"}>
          <ClockTimePicker label="Heure de début" value={start} onChange={onStartChange} allowEmpty />
          <ClockTimePicker label="Heure de fin" value={end} onChange={onEndChange} allowEmpty />
        </div>
        {recovery ? <p className="recovery-time-help">Ces horaires seront repris automatiquement dans le formulaire.</p> : null}
        </>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="save-button" type="button" onClick={onConfirm}>
            {duration ? "Valider" : halfDay ? "Valider la demi-journée" : "Valider les horaires"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function NonWorkingDayWarningDialog({
  date,
  group,
  onCancel,
  onConfirm,
}: {
  date: string | null;
  group: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!date) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-card warning-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="warning-title"
      >
        <span className="warning-symbol">!</span>
        <h2 id="warning-title">Journée non travaillée</h2>
        <p>
          Le {shortDate(date)} est un jour de repos ou un jour férié non travaillé
          pour le groupe {group}. Voulez-vous vraiment l’ajouter à la demande ?
        </p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" data-modal-close onClick={onCancel}>
            Annuler
          </button>
          <button className="warning-button" type="button" onClick={onConfirm}>
            Sélectionner quand même
          </button>
        </div>
      </section>
    </div>
  );
}

function shortChipDay(key: string) {
  const text = fromKey(key).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function periodTone(period: LeavePeriod) {
  const kind = period.leaveType === "half" ? halfBalanceOf(period) : period.leaveType || "annual";
  return TYPE_COLORS[kind] ?? TYPE_COLORS.annual;
}

function collectCancelableMonthDays(period: LeavePeriod, focusDate: string | null | undefined, monthPeriods: readonly LeavePeriod[]) {
  const periodDates = rangeKeys(period.from, period.to);
  const anchor = focusDate && periodDates.includes(focusDate) ? focusDate : period.from;
  const monthPrefix = anchor.slice(0, 7);
  const byDate = new Map<string, { date: string; color: string; typeLabel: string }>();

  for (const candidate of monthPeriods) {
    for (const date of rangeKeys(candidate.from, candidate.to)) {
      if (!date.startsWith(monthPrefix)) continue;
      if (!byDate.has(date)) {
        byDate.set(date, { date, color: periodTone(candidate), typeLabel: periodTypeLabel(candidate) });
      }
    }
  }
  for (const date of periodDates) {
    if (!byDate.has(date)) {
      byDate.set(date, { date, color: periodTone(period), typeLabel: periodTypeLabel(period) });
    }
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const monthLabel = fromKey(`${monthPrefix}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return { periodDates, anchor, days, monthLabel };
}

export function DeletePeriodDialog({
  period,
  focusDate,
  monthPeriods = [],
  saving,
  onCancel,
  onConfirm,
}: {
  period: LeavePeriod | null;
  focusDate?: string | null;
  monthPeriods?: LeavePeriod[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: (dates?: string[]) => void;
}) {
  const collected = period ? collectCancelableMonthDays(period, focusDate, monthPeriods) : null;
  const allDates = collected ? collected.days.map((item) => item.date) : [];
  const periodDates = collected ? collected.periodDates : [];
  const multiChoice = allDates.length > 1;
  const focusedInPeriod = Boolean(period && focusDate && periodDates.includes(focusDate));
  const initialSelected = multiChoice && focusedInPeriod && focusDate ? [focusDate] : periodDates;
  const [selectedDates, setSelectedDates] = useState<string[]>(initialSelected);

  useEffect(() => {
    if (!period) return;
    const next = collectCancelableMonthDays(period, focusDate, monthPeriods);
    const hasMulti = next.days.length > 1;
    const focused = Boolean(focusDate && next.periodDates.includes(focusDate));
    setSelectedDates(hasMulti && focused && focusDate ? [focusDate] : next.periodDates);
  }, [period, focusDate, monthPeriods]);

  if (!period || !collected) return null;
  const strike = period.leaveType === "strike";
  const selectedSet = new Set(selectedDates);
  const hasOtherMonthDays = allDates.length > periodDates.length;
  const allSelected = selectedDates.length === allDates.length;
  const onlyFocusedSelected = focusedInPeriod && selectedDates.length === 1 && selectedSet.has(focusDate!);
  const exactPeriodSelected =
    periodDates.length > 1 &&
    selectedDates.length === periodDates.length &&
    periodDates.every((date) => selectedSet.has(date));

  const toggleDate = (key: string) => {
    setSelectedDates((current) =>
      current.includes(key)
        ? current.filter((date) => date !== key)
        : [...current, key].sort(),
    );
  };

  const confirmLabel = (() => {
    if (saving) return strike ? "Suppression…" : "Annulation…";
    if (!multiChoice) return strike ? "Supprimer la grève" : "Annuler la période";
    if (!selectedDates.length) return "Choisissez au moins un jour";
    if (allSelected) {
      if (hasOtherMonthDays) return `Annuler tout le mois (${allDates.length} j)`;
      return strike ? "Supprimer toute la période" : "Annuler toute la période";
    }
    if (selectedDates.length === 1) return strike ? "Supprimer 1 journée" : "Annuler 1 journée";
    return `${strike ? "Supprimer" : "Annuler"} ${selectedDates.length} journées`;
  })();

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`modal-card warning-modal${multiChoice ? " delete-period-modal" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-period-title"
      >
        <span className="warning-symbol">!</span>
        <h2 id="delete-period-title">
          {strike && !hasOtherMonthDays ? "Supprimer cette journée de grève ?" : "Annuler cette période ?"}
        </h2>
        <p>
          {periodLabel(period.from, period.to)} · {periodTypeLabel(period)}
        </p>
        {multiChoice ? (
          <div className="delete-period-picker">
            {hasOtherMonthDays ? (
              <small className="delete-period-hint">
                Tous vos congés posés en {collected.monthLabel}
              </small>
            ) : null}
            <div className="delete-period-presets" role="group" aria-label="Choix rapide">
              {focusedInPeriod && focusDate ? (
                <button
                  type="button"
                  className={onlyFocusedSelected ? "active" : undefined}
                  onClick={() => setSelectedDates([focusDate])}
                >
                  Ce jour uniquement
                </button>
              ) : null}
              {hasOtherMonthDays && periodDates.length > 1 ? (
                <button
                  type="button"
                  className={exactPeriodSelected ? "active" : undefined}
                  onClick={() => setSelectedDates(periodDates)}
                >
                  Cette période ({periodDates.length} j)
                </button>
              ) : null}
              <button
                type="button"
                className={allSelected ? "active" : undefined}
                onClick={() => setSelectedDates(allDates)}
              >
                {hasOtherMonthDays ? `Tout le mois (${allDates.length} j)` : `Toute la période (${allDates.length} j)`}
              </button>
            </div>
            <div className="delete-period-days" role="group" aria-label="Jours à annuler">
              {collected.days.map((item) => {
                const picked = selectedSet.has(item.date);
                return (
                  <button
                    type="button"
                    key={item.date}
                    className={`delete-period-day${picked ? " selected" : ""}`}
                    style={{ "--chip-color": item.color } as CSSProperties}
                    title={item.typeLabel}
                    aria-pressed={picked}
                    onClick={() => toggleDate(item.date)}
                  >
                    <span className="delete-period-day-label">
                      <b aria-hidden="true" />
                      {shortChipDay(item.date)}
                    </span>
                    <i aria-hidden="true">{picked ? "×" : "+"}</i>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="modal-actions">
          <button className="secondary-button" type="button" data-modal-close onClick={onCancel}>
            Conserver
          </button>
          <button
            className="delete-confirm-button"
            type="button"
            onClick={() => onConfirm(multiChoice ? selectedDates : allDates)}
            disabled={saving || (multiChoice && selectedDates.length === 0)}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function MessageDialog({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="modal-card message-modal" role="alertdialog" aria-modal="true">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <h2>Impossible de continuer</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="save-button" type="button" onClick={onClose}>
            Compris
          </button>
        </div>
      </section>
    </div>
  );
}

export function AppUpdateDialog({
  open,
  checking,
  onLater,
  onUpdate,
}: {
  open: boolean;
  checking: boolean;
  onLater: () => void;
  onUpdate: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop update-available-backdrop" role="presentation">
      <section
        className="modal-card update-available-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-update-title"
      >
        <span className="update-available-symbol" aria-hidden="true">↻</span>
        <span className="step-label">Mise à jour à terminer</span>
        <h2 id="app-update-title">Une mise à jour est disponible</h2>
        <p>La mise à jour automatique n’a pas pu se charger correctement. Touchez le bouton ci-dessous pour charger la dernière version.</p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onLater}>Plus tard</button>
          <button className="save-button update-now-button" type="button" disabled={checking} onClick={onUpdate}>
            {checking ? "Chargement…" : "Mettre à jour maintenant"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function SuccessToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="success-toast" role="status" aria-live="polite">
      <span aria-hidden="true">✓</span>
      <p>{message}</p>
      <button type="button" onClick={onClose} aria-label="Fermer la confirmation">
        ×
      </button>
    </div>
  );
}

export function UndoToast({
  message,
  onUndo,
  onClose,
}: {
  message: string | null;
  onUndo: () => void;
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <p>{message}</p>
      <button className="undo-toast-action" type="button" onClick={onUndo}>
        Annuler
      </button>
      <button type="button" onClick={onClose} aria-label="Fermer la proposition d’annulation">
        ×
      </button>
    </div>
  );
}
