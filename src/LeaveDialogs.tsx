import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { ChoicePicker } from "./ChoicePicker";
import type { ManualYearAdjustments } from "./appModel";
import {
  HALF_MOMENT_OPTIONS,
  LEAVE_ALLOWANCES,
  TYPE_COLORS,
  TYPE_LABELS,
  s,
  type HalfMoment,
  type LeaveType,
} from "./planningLogic";

export function ManualAdjustmentsDialog({
  open,
  year,
  draft,
  setDraft,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  year: number;
  draft: Record<keyof ManualYearAdjustments, string>;
  setDraft: Dispatch<
    SetStateAction<Record<keyof ManualYearAdjustments, string>>
  >;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop manual-adjustments-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card manual-adjustments-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-adjustments-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Rattrapage {year}</span>
        <h2 id="manual-adjustments-title">Mes absences avant l’application</h2>
        <p className="manual-adjustments-intro">
          Indiquez uniquement ce qui n’est pas déjà enregistré dans le planning.
          Les nouvelles demandes seront ensuite ajoutées automatiquement.
        </p>

        <section className="manual-adjustment-section">
          <div className="manual-adjustment-heading">
            <span aria-hidden="true">1</span>
            <div>
              <h3>Jours déjà pris sans date</h3>
              <p>Ces nombres sont directement déduits de vos soldes {year}.</p>
            </div>
          </div>
          <div className="manual-leave-inputs">
            {([
              ["annualUsed", "Congés annuels", LEAVE_ALLOWANCES.annual],
              ["rttUsed", "RTT", LEAVE_ALLOWANCES.rtt],
              ["fractionUsed", "Fractionnement", LEAVE_ALLOWANCES.fraction],
            ] as const).map(([key, label, allowance]) => (
              <label key={key}>
                <span>{label}</span>
                <span className="manual-number-field">
                  <input
                    type="number"
                    min="0"
                    max={allowance}
                    step="0.5"
                    inputMode="decimal"
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  <small>jour{s(Number(draft[key]) || 0)}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="manual-adjustment-section sunday-adjustment-section">
          <div className="manual-adjustment-heading">
            <span aria-hidden="true">2</span>
            <div>
              <h3>Dimanches posés en congé</h3>
              <p>
                Ils sont retirés des dimanches travaillés avant le calcul de chaque
                prime.
              </p>
            </div>
          </div>
          <div className="manual-sunday-inputs">
            {([
              ["sundayLeaveJanJun", "Janvier à juin", "Prime de juillet"],
              ["sundayLeaveJulSep", "Juillet à septembre", "Prime d’octobre"],
              ["sundayLeaveOctNov", "Octobre à novembre", "Prime de décembre"],
              ["sundayLeaveDec", "Décembre", `Prime de janvier ${year + 1}`],
            ] as const).map(([key, period, pay]) => (
              <label key={key}>
                <span className="manual-sunday-period">
                  <strong>{period}</strong>
                  <small>→ {pay}</small>
                </span>
                <span className="manual-number-field">
                  <input
                    type="number"
                    min="0"
                    max="53"
                    step="1"
                    inputMode="numeric"
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    aria-label={`Dimanches posés de ${period.toLowerCase()}`}
                  />
                  <small>dimanche{s(Number(draft[key]) || 0)}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="manual-sunday-help">
            Les dimanches couverts par un congé daté dans l’application sont déjà
            comptés : ne les ajoutez pas ici.
          </p>
        </section>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="save-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer et recalculer"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function RangeLeaveDialog({
  open,
  leaveType,
  setLeaveType,
  halfMoment,
  setHalfMoment,
  onClose,
  onStartSelection,
}: {
  open: boolean;
  leaveType: LeaveType;
  setLeaveType: Dispatch<SetStateAction<LeaveType>>;
  halfMoment: HalfMoment;
  setHalfMoment: Dispatch<SetStateAction<HalfMoment>>;
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
        aria-labelledby="range-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Mon planning</span>
        <h2 id="range-title">Ajouter une période de congés</h2>
        <p>
          Choisissez le type de congé, puis sélectionnez une ou plusieurs dates
          directement dans le calendrier.
        </p>
        {leaveType === "other" ? (
          <div className="request-option-groups manual-leave-options">
            <section className="request-option-group">
              <h3>Divers</h3>
              <div className="type-tabs">
                <button
                  type="button"
                  className="active"
                  style={{ "--type-color": TYPE_COLORS.other } as CSSProperties}
                >
                  <i />
                  {TYPE_LABELS.other}
                </button>
              </div>
              <p className="request-help">Sans effet sur la paie ni sur les soldes.</p>
            </section>
          </div>
        ) : (
          <div className="request-option-groups manual-leave-options">
            {([
              ["Congés courants", ["annual", "half", "rtt"]],
              ["Autres congés", ["fraction", "childcare", "exceptional"]],
            ] as Array<[string, LeaveType[]]>).map(([label, types]) => (
              <section className="request-option-group" key={label}>
                <h3>{label}</h3>
                <div className="type-tabs" aria-label={label}>
                  {types.map((type) => (
                    <button
                      type="button"
                      className={leaveType === type ? "active" : ""}
                      style={{ "--type-color": TYPE_COLORS[type] } as CSSProperties}
                      onClick={() => setLeaveType(type)}
                      key={type}
                    >
                      <i />
                      {TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {leaveType === "half" && (
          <div className="leave-type-field">
            <span>Moitié de journée</span>
            <ChoicePicker
              value={halfMoment}
              options={HALF_MOMENT_OPTIONS}
              onChange={setHalfMoment}
              ariaLabel="Choisir le matin ou l’après-midi"
              className="leave-type-picker"
            />
          </div>
        )}
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
