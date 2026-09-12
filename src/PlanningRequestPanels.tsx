import type { CSSProperties } from "react";
import type { RequestKind } from "./appModel";
import {
  GROUP_OPTIONS,
  fromKey,
  longDate,
  type SelectionType,
} from "./planningLogic";

/** Bandeau de préparation d'une note posée sur plusieurs dates. */
export function NoteSelectionPanel({
  open,
  noteColor,
  noteText,
  noteDates,
  savingDay,
  onCancel,
  onSave,
}: {
  open: boolean;
  noteColor: string;
  noteText: string;
  noteDates: string[];
  savingDay: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <section
      className="request-panel calendar-request-panel"
      id="note-selection-panel"
      style={{ "--active-color": noteColor } as CSSProperties}
    >
      <div className="request-heading">
        <div>
          <span className="step-label">Note en préparation</span>
          <h2>Choisir plusieurs dates</h2>
        </div>
        <button className="text-button danger" type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
      <p className="request-help">{noteText}</p>
      <div className="request-bottom">
        <p>
          <strong>{noteDates.length}</strong>{" "}
          {noteDates.length > 1 ? "dates sélectionnées" : "date sélectionnée"}.
          Cliquez sur une date colorée pour la retirer.
        </p>
        <button
          className="validate-button"
          type="button"
          onClick={onSave}
          disabled={!noteDates.length || !noteText.trim() || savingDay}
        >
          {savingDay ? "Synchronisation…" : "Enregistrer la note"}
        </button>
      </div>
    </section>
  );
}

/** Invite à toucher une date du calendrier pour situer une récupération. */
export function RecoveryDatePickingPanel({
  open,
  onCancel,
}: {
  open: boolean;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <section className="request-panel recovery-date-picking-panel" aria-label="Sélection de la date de récupération">
      <div>
        <span className="step-label">Récupération</span>
        <h2>Sélectionnez une date dans le calendrier</h2>
        <p>Le cycle de votre groupe est affiché normalement. Touchez la date souhaitée pour continuer.</p>
      </div>
      <button className="text-button danger" type="button" onClick={onCancel}>
        Annuler la sélection
      </button>
    </section>
  );
}

/** Première étape d'une demande : ce que l'on pose avant de choisir les dates. */
export function RequestChooserDialog({
  open,
  requestChooserDate,
  onClose,
  onChoose,
}: {
  open: boolean;
  requestChooserDate: string | null;
  onClose: () => void;
  onChoose: (kind: RequestKind, requestedType: SelectionType) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card request-choice"
        role="dialog"
        aria-modal="true"
        aria-label="Poser un congé"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Étape 1 sur 3</span>
        <h2 id="request-choice-title">Que voulez-vous poser&nbsp;?</h2>
        <p>
          {requestChooserDate
            ? `Choisissez le type à appliquer au ${longDate(fromKey(requestChooserDate))}. Vous pourrez encore le modifier ensuite.`
            : "Commencez par un choix courant. Les choix moins fréquents restent disponibles juste en dessous."}
        </p>
        <div className="choice-grid request-primary-choice-grid">
          <button type="button" onClick={() => onChoose("leave", "annual")}>
            <strong>CA</strong>
            <span>Congés annuels</span>
          </button>
          <button type="button" onClick={() => onChoose("leave", "rtt")}>
            <strong>RTT</strong>
            <span>Journée ou période</span>
          </button>
          <button type="button" onClick={() => onChoose("leave", "fraction")}>
            <strong>Fractionnement</strong>
            <span>Jour de fractionnement</span>
          </button>
          <button
            type="button"
            className="recovery-request-choice"
            onClick={() => onChoose("recovery", "recovery_day")}
          >
            <strong>Récupération</strong>
            <span>À déduire de votre solde d’heures</span>
          </button>
        </div>
        <details className="request-other-choices">
          <summary>Autres</summary>
          <div className="choice-grid">
            <button type="button" className="cet-leave-choice" onClick={() => onChoose("leave", "cet")}><strong>CET</strong><span>Congé pris sur le compte épargne-temps</span></button>
            <button type="button" className="sick-leave-choice" onClick={() => onChoose("leave", "sick")}><strong>Maladie</strong><span>Arrêt enregistré dans le suivi</span></button>
            <button type="button" onClick={() => onChoose("leave", "childcare")}><strong>Garde d’enfant</strong><span>Absence exceptionnelle</span></button>
            <button type="button" onClick={() => onChoose("leave", "exceptional")}><strong>Jour exceptionnel</strong><span>Selon votre situation</span></button>
            <button type="button" className="other-leave-choice" onClick={() => onChoose("other", "other")}><strong>Divers</strong><span>Jour non travaillé dans le planning</span></button>
            <button type="button" className="strike-leave-choice" onClick={() => onChoose("strike", "strike")}><strong>Grève</strong><span>Avec retenue de paie estimée</span></button>
          </div>
        </details>
      </section>
    </div>
  );
}

/** Choix du groupe de travail, qui recalcule le planning sur-le-champ. */
export function GroupChooserDialog({
  open,
  group,
  onClose,
  onChange,
}: {
  open: boolean;
  group: number;
  onClose: () => void;
  onChange: (group: number) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card group-choice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-choice-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <span className="step-label">Cycle de travail</span>
        <h2 id="group-choice-title">Choisir mon groupe</h2>
        <p>Le planning est recalculé immédiatement avec le groupe choisi.</p>
        <div className="group-choice-grid">
          {GROUP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={group === option.value ? "active" : ""}
              aria-pressed={group === option.value}
              onClick={() => onChange(option.value)}
            >
              <span>Groupe</span>
              <strong>{option.value}</strong>
              {group === option.value ? <small>Actuel</small> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
