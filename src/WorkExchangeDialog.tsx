import type { Dispatch, SetStateAction } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { GROUP_OPTIONS } from "./planningLogic";
import { WorkExchangeDatePicker } from "./WorkExchangeDatePicker";
import type { WorkExchangeDraft } from "./workExchange";

type Props = {
  open: boolean;
  group: number;
  draft: WorkExchangeDraft;
  setDraft: Dispatch<SetStateAction<WorkExchangeDraft>>;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function WorkExchangeDialog({
  open,
  group,
  draft,
  setDraft,
  error,
  saving,
  onClose,
  onSave,
  onDelete,
}: Props) {
  if (!open) return null;
  const editing = Boolean(draft.id);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal-card work-exchange-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-exchange-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        <span className="step-label">Organisation entre collègues</span>
        <h2 id="work-exchange-title">{editing ? "Modifier l’échange" : "Enregistrer un échange"}</h2>
        <p>
          Les deux dates sont obligatoires et seront toujours enregistrées ensemble.
          L’échange ne modifie ni la paie ni les congés.
        </p>
        <div className="work-exchange-person-grid">
          <label>
            <span>Collègue</span>
            <input
              type="text"
              value={draft.partnerName}
              maxLength={80}
              autoComplete="off"
              placeholder="Prénom et/ou nom"
              onChange={(event) => setDraft((current) => ({ ...current, partnerName: event.target.value }))}
            />
          </label>
          <div className="work-exchange-group-field">
            <span>Son groupe</span>
            <ChoicePicker
              value={draft.partnerGroup}
              options={GROUP_OPTIONS.filter((option) => option.value !== group)}
              onChange={(partnerGroup) => setDraft((current) => ({ ...current, partnerGroup }))}
              ariaLabel="Choisir le groupe du collègue"
              className="work-exchange-group-picker"
            />
          </div>
        </div>

        <div className="work-exchange-date-grid">
          <label className="work-exchange-date-card agreement">
            <strong>Journée de votre cycle · Groupe {group}</strong>
            <span>Vous deviez travailler · {draft.partnerName.trim() || "Votre collègue"} vous remplace</span>
            <WorkExchangeDatePicker
              value={draft.agreementDate}
              ownerGroup={group}
              otherGroup={draft.partnerGroup}
              ariaLabel="Choisir la journée de votre cycle"
              onChange={(agreementDate) => setDraft((current) => ({ ...current, agreementDate }))}
            />
          </label>
          <label className="work-exchange-date-card return">
            <strong>Journée de son cycle · Groupe {draft.partnerGroup}</strong>
            <span>
              {draft.partnerName.trim() || "Votre collègue"} devait travailler · Vous {colleagueObjectPronoun(draft.partnerName)} remplacez
            </span>
            <WorkExchangeDatePicker
              value={draft.returnDate}
              ownerGroup={draft.partnerGroup}
              otherGroup={group}
              ariaLabel="Choisir la journée du cycle du collègue"
              onChange={(returnDate) => setDraft((current) => ({ ...current, returnDate }))}
            />
          </label>
        </div>

        {error ? <p className="work-exchange-error" role="alert">{error}</p> : null}
        <div className="modal-actions work-exchange-actions">
          {editing ? (
            <button className="delete-button" type="button" onClick={onDelete} disabled={saving}>
              Supprimer l’échange
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
          <button className="save-button" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Synchronisation…" : editing ? "Enregistrer les modifications" : "Valider les deux dates"}
          </button>
        </div>
      </section>
    </div>
  );
}
