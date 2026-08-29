import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES } from "./mecenat";
import { minutesLabel, type OvertimeDisposition } from "./overtime";
import { DAY_LABELS, getDayInfo } from "./planningLogic";

type MecenatDraft = { date: string; start: string; end: string };
type MecenatCalculation = {
  dayMinutes: number;
  nightMinutes: number;
  grossAmountCents: number;
};

export function MecenatDialog({
  open,
  draft,
  setDraft,
  calculation,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: MecenatDraft;
  setDraft: Dispatch<SetStateAction<MecenatDraft>>;
  calculation: MecenatCalculation | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card overtime-modal mecenat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mecenat-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Ma paie</span>
        <h2 id="mecenat-title">Déclarer un mécénat</h2>
        <p>
          Indiquez les horaires : Planning Solo sépare automatiquement les heures
          avant et après 22 h, y compris après minuit.
        </p>
        <div className="overtime-form">
          <label>
            <span>Date du mécénat</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) =>
                setDraft((current) => ({ ...current, date: event.target.value }))
              }
            />
          </label>
          <div className="overtime-time-grid">
            <label>
              <span>Début</span>
              <input
                type="time"
                step="900"
                value={draft.start}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, start: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Fin</span>
              <input
                type="time"
                step="900"
                value={draft.end}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, end: event.target.value }))
                }
              />
            </label>
            <small>
              Si l’heure de fin est antérieure au début, la vacation se termine le
              lendemain.
            </small>
          </div>
          <p className="mecenat-next-month-note">
            Le paiement sera automatiquement intégré à la paie du mois suivant.
          </p>
          {calculation ? (
            <section className="mecenat-preview" aria-live="polite">
              <div>
                <span>De 7 h à 22 h</span>
                <strong>
                  {minutesLabel(calculation.dayMinutes)} ·{" "}
                  {euros(
                    (calculation.dayMinutes / 60) *
                      (MECENAT_REGULATORY_RATES.dayRateCents / 100),
                  )}
                </strong>
              </div>
              <div>
                <span>De 22 h à 7 h</span>
                <strong>
                  {minutesLabel(calculation.nightMinutes)} ·{" "}
                  {euros(
                    (calculation.nightMinutes / 60) *
                      (MECENAT_REGULATORY_RATES.nightRateCents / 100),
                  )}
                </strong>
              </div>
              <p>
                <span>Total brut</span>
                <strong>{euros(calculation.grossAmountCents / 100)}</strong>
              </p>
            </section>
          ) : (
            <p className="allowance-note warn">
              Les heures de début et de fin doivent être différentes.
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button
            className="save-button"
            type="button"
            onClick={onSave}
            disabled={saving || !calculation}
          >
            {saving ? "Enregistrement…" : "Enregistrer le mécénat"}
          </button>
        </div>
      </section>
    </div>
  );
}

type OvertimeDraft = {
  date: string;
  start: string;
  end: string;
  disposition: OvertimeDisposition;
};

export function OvertimeDialog({
  open,
  draft,
  setDraft,
  saving,
  group,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: OvertimeDraft;
  setDraft: Dispatch<SetStateAction<OvertimeDraft>>;
  saving: boolean;
  group: number;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
    ? new Date(`${draft.date}T12:00:00`)
    : null;
  const selectedDay = selectedDate ? getDayInfo(selectedDate, group) : null;
  const sundayOrHoliday = Boolean(
    selectedDate && (selectedDate.getDay() === 0 || selectedDay?.holiday),
  );
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card overtime-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overtime-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Ma paie et mes récupérations</span>
        <h2 id="overtime-title">Déclarer des heures supplémentaires</h2>
        <p>Saisissez la date et les horaires, puis choisissez leur destination.</p>
        <div className="overtime-form">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) =>
                setDraft((current) => ({ ...current, date: event.target.value }))
              }
            />
            <small className={sundayOrHoliday ? "overtime-special-day-note" : undefined}>
              {sundayOrHoliday
                ? `Tarif dimanche/jour férié reconnu automatiquement${selectedDay?.holiday ? ` : ${selectedDay.holiday}` : ""}.`
                : "Le tarif dimanche/jour férié est appliqué automatiquement selon la date."}
            </small>
          </label>
          <div className="overtime-time-grid">
            <strong className="overtime-time-title">Horaires</strong>
            <label>
              <span>De</span>
              <input
                type="time"
                step="900"
                value={draft.start}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, start: event.target.value }))
                }
              />
            </label>
            <label>
              <span>À</span>
              <input
                type="time"
                step="900"
                value={draft.end}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, end: event.target.value }))
                }
              />
            </label>
            <small>
              La nuit est reconnue automatiquement de 22 h à 7 h. Le dimanche et
              les jours fériés sont majorés de deux tiers. Les horaires peuvent
              passer minuit.
            </small>
          </div>
          <fieldset className="overtime-choice-field disposition-choice">
            <legend>Que faire de ces heures ?</legend>
            <div className="overtime-destination-grid">
              <button
                type="button"
                className={draft.disposition === "paid" ? "active paid" : "paid"}
                onClick={() =>
                  setDraft((current) => ({ ...current, disposition: "paid" }))
                }
              >
                <strong>À payer</strong>
                <span>Ajoutées à la paie du mois suivant</span>
              </button>
              <button
                type="button"
                className={
                  draft.disposition === "recovery" ? "active recovery" : "recovery"
                }
                onClick={() =>
                  setDraft((current) => ({ ...current, disposition: "recovery" }))
                }
              >
                <strong>À récupérer</strong>
                <span>Ajoutées au solde heure pour heure</span>
              </button>
            </div>
          </fieldset>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="save-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer les heures"}
          </button>
        </div>
      </section>
    </div>
  );
}

type SolidarityDraft = { hours: string; minutes: string };

export function SolidarityHoursDialog({
  open,
  draft,
  setDraft,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: SolidarityDraft;
  setDraft: Dispatch<SetStateAction<SolidarityDraft>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card overtime-modal solidarity-hours-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="solidarity-hours-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Solde de récupération</span>
        <h2 id="solidarity-hours-title">Ajouter des heures manuellement</h2>
        <p>
          Indiquez le total personnel accumulé au fil des années. Ces heures
          créditent uniquement votre solde de récupération.
        </p>
        <div className="overtime-duration-grid solidarity-duration-grid">
          <label>
            <span>Heures</span>
            <input
              type="number"
              min="0"
              max="10000"
              step="0.25"
              inputMode="decimal"
              value={draft.hours}
              onChange={(event) =>
                setDraft((current) => ({ ...current, hours: event.target.value }))
              }
              autoFocus
            />
          </label>
          <label>
            <span>Minutes</span>
            <input
              type="number"
              min="0"
              max="59"
              step="5"
              inputMode="numeric"
              value={draft.minutes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, minutes: event.target.value }))
              }
            />
          </label>
        </div>
        <p className="solidarity-hours-note">
          Chaque ajout reste visible dans l’historique et peut être supprimé en
          cas d’erreur.
        </p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="save-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Ajouter au solde"}
          </button>
        </div>
      </section>
    </div>
  );
}

export type RecoveryDraft = {
  date: string;
  kind: "hours" | "half" | "day" | "holiday" | "training";
  hours: string;
  minutes: string;
  start: string;
  durationMinutes: number | null;
  trainingMinutes: 180 | 360;
};

const RECOVERY_KIND_LABELS: Record<RecoveryDraft["kind"], string> = {
  day: "Récupération en journée",
  half: "Récupération en demi-journée",
  hours: "Récupération en heures",
  holiday: "Récupération de jour férié",
  training: "Récupération sur une formation",
};

const RECOVERY_DURATION_OPTIONS: Record<
  Exclude<RecoveryDraft["kind"], "training">,
  ReadonlyArray<readonly [number | null, string]>
> = {
  day: [[480, "8 h"], [360, "6 h"], [240, "4 h"], [null, "Durée libre"]],
  half: [[240, "4 h"], [120, "2 h"], [null, "Durée libre"]],
  hours: [[480, "8 h"], [360, "6 h"], [240, "4 h"], [120, "2 h"]],
  holiday: [[480, "8 h"], [240, "4 h"], [null, "Durée libre"]],
};

export function RecoveryRangeDialog({
  open,
  kind,
  setKind,
  onClose,
  onStartSelection,
}: {
  open: boolean;
  kind: RecoveryDraft["kind"];
  setKind: (kind: RecoveryDraft["kind"]) => void;
  onClose: () => void;
  onStartSelection: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card range-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-range-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Mon planning</span>
        <h2 id="recovery-range-title">Ajouter une récupération</h2>
        <p>
          Choisissez le type de récupération, puis sélectionnez une ou plusieurs dates
          directement dans le calendrier.
        </p>
        <div className="request-option-groups manual-leave-options">
          {([
            ["Récupérations courantes", ["day", "half", "hours"]],
            ["Autres récupérations", ["holiday", "training"]],
          ] as Array<[string, RecoveryDraft["kind"][]]>).map(([label, kinds]) => (
            <section className="request-option-group" key={label}>
              <h3>{label}</h3>
              <div className="type-tabs" role="group" aria-label={label}>
                {kinds.map((candidate) => (
                  <button
                    type="button"
                    className={kind === candidate ? "active" : ""}
                    style={{ "--type-color": "#f0a574" } as CSSProperties}
                    onClick={() => setKind(candidate)}
                    key={candidate}
                  >
                    <i />
                    {RECOVERY_KIND_LABELS[candidate]}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="modal-actions range-create-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="save-button" type="button" onClick={onStartSelection}>
            Sélectionner dans le calendrier
          </button>
        </div>
      </section>
    </div>
  );
}

function recoveryCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}

export function RecoveryUseDialog({
  open,
  draft,
  setDraft,
  group,
  showCalendar,
  remainingMinutes,
  saving,
  onClose,
  onSelectInCalendar,
  onSave,
  submitLabel = "Poser la récupération",
}: {
  open: boolean;
  draft: RecoveryDraft;
  setDraft: Dispatch<SetStateAction<RecoveryDraft>>;
  group: number;
  showCalendar: boolean;
  remainingMinutes: number;
  saving: boolean;
  onClose: () => void;
  onSelectInCalendar: () => void;
  onSave: () => void;
  submitLabel?: string;
}) {
  if (!open) return null;
  const chosenDate = recoveryCalendarDate(draft.date);
  const chosenDateInfo = getDayInfo(chosenDate, group);
  const durationOptions =
    draft.kind === "training" ? null : RECOVERY_DURATION_OPTIONS[draft.kind];
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card overtime-modal recovery-use-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-use-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Mon planning</span>
        <h2 id="recovery-use-title">Ajouter une récupération</h2>
        <p>Choisissez le type et la durée, puis sélectionnez la date directement dans le calendrier.</p>
        <p className="recovery-available">
          Solde disponible <strong>{minutesLabel(remainingMinutes)}</strong>
        </p>
        <div className="overtime-form">
          <div className="request-option-groups manual-leave-options recovery-category-options">
            {([
              ["Récupérations courantes", ["day", "half", "hours"]],
              ["Autres récupérations", ["holiday", "training"]],
            ] as Array<[string, RecoveryDraft["kind"][]]>).map(([label, kinds]) => (
              <section className="request-option-group" key={label}>
                <h3>{label}</h3>
                <div className="type-tabs" role="group" aria-label={label}>
                  {kinds.map((kind) => (
                    <button
                      type="button"
                      key={kind}
                      className={draft.kind === kind ? "active" : ""}
                      style={{ "--type-color": "#f0b083" } as CSSProperties}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          kind,
                          durationMinutes:
                            kind === "half" ? 240 : kind === "hours" ? 480 : 480,
                        }))
                      }
                    >
                      <i />
                      {RECOVERY_KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <p className="recovery-kind-heading">{RECOVERY_KIND_LABELS[draft.kind]}</p>
          {!showCalendar ? (
            <section className="recovery-fixed-date" aria-label="Date de récupération sélectionnée">
              <span>Date déjà sélectionnée</span>
              <strong>
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(chosenDate)}
              </strong>
              <small>
                Groupe {group} · {DAY_LABELS[chosenDateInfo.kind]}
                {chosenDateInfo.holiday ? ` · ${chosenDateInfo.holiday}` : ""}
              </small>
            </section>
          ) : null}
          <fieldset className="overtime-choice-field recovery-duration-field">
            <legend>Heures à poser</legend>
            <div className="recovery-duration-choice">
              {draft.kind === "training" ? ([
                [180, "3 h"],
                [360, "6 h"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={draft.trainingMinutes === value ? "active" : ""}
                  onClick={() => setDraft((current) => ({ ...current, trainingMinutes: value }))}
                >
                  {label}
                </button>
              )) : durationOptions!.map(([value, label]) => (
                <button
                  key={value ?? "custom"}
                  type="button"
                  className={draft.durationMinutes === value ? "active" : ""}
                  onClick={() => setDraft((current) => ({ ...current, durationMinutes: value }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {draft.kind !== "training" && draft.durationMinutes === null ? (
            <div className="overtime-duration-grid recovery-custom-duration">
              <label>
                <span>Heures</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  inputMode="decimal"
                  value={draft.hours}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, hours: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Minutes</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="5"
                  inputMode="numeric"
                  value={draft.minutes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, minutes: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : null}
          {draft.kind !== "training" ? <label>
            <span>
              Heure de début <small>(facultatif)</small>
            </span>
            <input
              type="time"
              step="900"
              value={draft.start}
              onChange={(event) =>
                setDraft((current) => ({ ...current, start: event.target.value }))
              }
            />
          </label> : null}
          {showCalendar ? (
            <button
              className="recovery-calendar-trigger"
              type="button"
              onClick={onSelectInCalendar}
            >
              <strong>Sélectionner dans le calendrier</strong>
              <span>Le cycle de votre groupe sera visible pour choisir la date.</span>
            </button>
          ) : null}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          {!showCalendar ? (
            <button
              className="save-button"
              type="button"
              onClick={onSave}
              disabled={saving || remainingMinutes <= 0}
            >
              {saving ? "Enregistrement…" : submitLabel}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
