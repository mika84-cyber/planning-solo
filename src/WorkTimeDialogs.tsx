import type { Dispatch, SetStateAction } from "react";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES } from "./mecenat";
import { minutesLabel, type OvertimeDisposition } from "./overtime";

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
  onClose,
  onSave,
}: {
  open: boolean;
  draft: OvertimeDraft;
  setDraft: Dispatch<SetStateAction<OvertimeDraft>>;
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
            <small>Hors dimanche et jour férié</small>
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
              La nuit est reconnue automatiquement de 22 h à 7 h. Les horaires
              peuvent passer minuit.
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

type RecoveryDraft = {
  date: string;
  kind: "hours" | "half" | "day" | "holiday" | "training";
  hours: string;
  minutes: string;
  start: string;
  trainingMinutes: 180 | 360;
};

export function RecoveryUseDialog({
  open,
  draft,
  setDraft,
  workDayMinutes,
  trainingMinutes,
  remainingMinutes,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: RecoveryDraft;
  setDraft: Dispatch<SetStateAction<RecoveryDraft>>;
  workDayMinutes: number;
  trainingMinutes: number;
  remainingMinutes: number;
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
        className="modal-card overtime-modal recovery-use-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-use-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Congés et récupérations</span>
        <h2 id="recovery-use-title">Utiliser mes heures de récupération</h2>
        <p className="recovery-available">
          Solde disponible <strong>{minutesLabel(remainingMinutes)}</strong>
        </p>
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
          </label>
          <fieldset className="overtime-choice-field">
            <legend>Durée</legend>
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
              )) : ([
                ["hours", "Durée libre"],
                ["half", `Demi-journée · ${minutesLabel(workDayMinutes / 2)}`],
                ["day", `Journée · ${minutesLabel(workDayMinutes)}`],
                ["holiday", `Jour férié · ${minutesLabel(workDayMinutes)}`],
                ["training", `Formation · ${minutesLabel(trainingMinutes)}`],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={draft.kind === value ? "active" : ""}
                  onClick={() => setDraft((current) => ({ ...current, kind: value }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {draft.kind === "hours" ? (
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
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button
            className="save-button"
            type="button"
            onClick={onSave}
            disabled={saving || remainingMinutes <= 0}
          >
            {saving ? "Enregistrement…" : "Poser la récupération"}
          </button>
        </div>
      </section>
    </div>
  );
}
