import type { LeavePeriod } from "./appModel";
import {
  TYPE_LABELS,
  fromKey,
  leaveTypeLabel,
  longDate,
  periodLabel,
  shortDate,
  type SelectionType,
} from "./planningLogic";

export function TimeSelectionDialog({
  date,
  activeType,
  start,
  end,
  onStartChange,
  onEndChange,
  onClose,
  onConfirm,
}: {
  date: string | null;
  activeType: SelectionType;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!date) return null;
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
        <h2 id="time-title">Indiquez les horaires</h2>
        <p>{longDate(fromKey(date))}</p>
        <div className="time-fields">
          <label htmlFor="request-time-start">
            <span>De</span>
            <input
              id="request-time-start"
              aria-label="De"
              type="time"
              min="09:00"
              max="19:30"
              step="900"
              value={start}
              onChange={(event) => onStartChange(event.target.value)}
            />
          </label>
          <label htmlFor="request-time-end">
            <span>À</span>
            <input
              id="request-time-end"
              aria-label="À"
              type="time"
              min="09:00"
              max="19:30"
              step="900"
              value={end}
              onChange={(event) => onEndChange(event.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="save-button" type="button" onClick={onConfirm}>
            Valider les horaires
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

export function DeletePeriodDialog({
  period,
  saving,
  onCancel,
  onConfirm,
}: {
  period: LeavePeriod | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!period) return null;
  const strike = period.leaveType === "strike";
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-card warning-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-period-title"
      >
        <span className="warning-symbol">!</span>
        <h2 id="delete-period-title">
          {strike ? "Supprimer cette journée de grève ?" : "Annuler cette période ?"}
        </h2>
        <p>
          {periodLabel(period.from, period.to)} · {leaveTypeLabel(period.leaveType)}
        </p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" data-modal-close onClick={onCancel}>
            Conserver
          </button>
          <button className="delete-confirm-button" type="button" onClick={onConfirm} disabled={saving}>
            {saving
              ? strike
                ? "Suppression…"
                : "Annulation…"
              : strike
                ? "Supprimer la grève"
                : "Annuler la période"}
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
        <span className="step-label">Nouvelle version publiée</span>
        <h2 id="app-update-title">Une mise à jour est disponible</h2>
        <p>Vous choisissez quand charger la dernière version. La page ne sera actualisée qu’après votre confirmation.</p>
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
