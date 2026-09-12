import type { CSSProperties } from "react";
import { RequestValidationSummary } from "./RequestValidationSummary";
import type { RequestKind, SelectedDay } from "./appModel";
import type { WorkQuota } from "./overtime";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  type SelectionType,
} from "./planningLogic";

export type RequestSelectionPanelProps = {
  requestKind: RequestKind | null;
  sickRequest: boolean;
  activeType: SelectionType;
  setActiveType: (type: SelectionType) => void;
  selectedList: SelectedDay[];
  selectedCounts: Record<string, number>;
  group: number;
  workQuota: WorkQuota;
  recoveryBalanceRemaining: number;
  leaveRemainingByType: Record<string, number>;
  savingRequest: boolean;
  /** Sélection incomplète ou solde à zéro : l'enregistrement reste fermé. */
  selectionBlocked: boolean;
  onCancel: () => void;
  onSelectLeaveType: (type: SelectionType) => void;
  onSelectRecoveryType: (type: SelectionType) => void;
  onValidateAndOpenForm: () => void;
  onSaveToPlanning: () => void;
};

/** Deuxième et troisième étapes d'une demande : les types, puis la relecture. */
export function RequestSelectionPanel({
  requestKind,
  sickRequest,
  activeType,
  setActiveType,
  selectedList,
  selectedCounts,
  group,
  workQuota,
  recoveryBalanceRemaining,
  leaveRemainingByType,
  savingRequest,
  selectionBlocked,
  onCancel,
  onSelectLeaveType,
  onSelectRecoveryType,
  onValidateAndOpenForm,
  onSaveToPlanning,
}: RequestSelectionPanelProps) {
  if (!requestKind) return null;

  return (
    <section
      className={`request-panel calendar-request-panel${sickRequest ? " sick-request-panel" : requestKind === "other" ? " other-request-panel" : requestKind === "strike" ? " strike-request-panel" : ""}`}
      id="request-panel"
      style={
        { "--active-color": TYPE_COLORS[activeType] } as CSSProperties
      }
    >
      <div className="request-heading">
        <div>
          <span className="step-label">
            {requestKind === "strike" ? "Ajout direct au planning" : "Étape 2 sur 3 · Choisissez les dates"}
          </span>
          <h2>
            {requestKind === "leave"
              ? sickRequest
                ? "Sélectionnez votre arrêt maladie"
                : "Sélectionnez vos congés"
              : requestKind === "other"
                ? "Sélectionnez vos dates Divers"
                : requestKind === "strike"
                  ? "Ajoutez une journée de grève"
                : "Sélectionnez vos récupérations"}
          </h2>
        </div>
        <button
          className="text-button danger"
          type="button"
          onClick={onCancel}
          aria-label={requestKind === "strike" ? "Fermer" : "Annuler la demande"}
        >
          {requestKind === "strike" ? "Fermer" : "Annuler"}
        </button>
      </div>
      {requestKind === "leave" && !sickRequest ? (
        <p className="multi-type-request-help">
          <strong>Vous pouvez mélanger plusieurs types dans une même demande.</strong>
          Choisissez un type, touchez ses dates dans le planning, puis changez de type si nécessaire.
        </p>
      ) : null}
      {requestKind === "other" ? (
        <div className="request-option-groups other-request-options">
          <section className="request-option-group">
            <h3>Divers</h3>
            <div className="type-tabs" role="group" aria-label="Divers">
              <button
                type="button"
                className="active"
                style={{ "--type-color": TYPE_COLORS.other } as CSSProperties}
              >
                {TYPE_LABELS.other}
                {selectedCounts.other ? <b>{selectedCounts.other}</b> : null}
              </button>
            </div>
            <p className="request-help">
              Ces dates seront visibles dans le planning et déduites des jours travaillés, sans effet sur la paie ni sur les soldes de congés.
            </p>
          </section>
        </div>
      ) : requestKind === "strike" ? (
        <div className="request-option-groups strike-request-options">
          <section className="request-option-group">
            <h3>Grève</h3>
            <div className="type-tabs" role="group" aria-label="Grève">
              <button
                type="button"
                className="active"
                style={{ "--type-color": TYPE_COLORS.strike } as CSSProperties}
              >
                <i />
                {TYPE_LABELS.strike}
                {selectedCounts.strike ? <b>{selectedCounts.strike}</b> : null}
              </button>
            </div>
            <p className="request-help">
              Touchez une journée travaillée : elle sera ajoutée immédiatement, sans déduction de congé, avec retenue brute estimée au trentième.
            </p>
          </section>
        </div>
      ) : requestKind === "leave" ? (
        sickRequest ? (
          <div className="request-option-groups sick-request-options">
            <section className="request-option-group">
              <h3>Arrêt maladie</h3>
              <div className="type-tabs" role="group" aria-label="Arrêt maladie">
                <button
                  type="button"
                  className="active"
                  style={{ "--type-color": TYPE_COLORS.sick } as CSSProperties}
                >
                  <i />
                  {TYPE_LABELS.sick}
                  {selectedCounts.sick ? <b>{selectedCounts.sick}</b> : null}
                </button>
              </div>
              <p className="request-help">
                L’arrêt sera compté dans votre suivi. Un CA déjà posé sera retiré et recrédité automatiquement. Les autres congés ne bloquent pas l’arrêt et resteront annulables manuellement.
              </p>
            </section>
          </div>
        ) : (
        <div className="request-option-groups request-option-groups-guided">
          <section className="request-option-group request-option-group-primary">
            <h3>Choix courants</h3>
            <div className="type-tabs" role="group" aria-label="Choix courants">
              {(["annual", "half", "rtt", "fraction"] as SelectionType[]).map((type) => (
                <button type="button" className={activeType === type ? "active" : ""} style={{ "--type-color": TYPE_COLORS[type] } as CSSProperties} onClick={() => onSelectLeaveType(type)} key={type}>
                  <i />{TYPE_LABELS[type]}{selectedCounts[type] ? <b>{selectedCounts[type]}</b> : null}
                </button>
              ))}
            </div>
          </section>
          <details className="request-advanced-types" open={(["childcare", "exceptional", "cet"] as SelectionType[]).includes(activeType)}>
            <summary><span><strong>Autres types de congé</strong><small>Garde d’enfant, jour exceptionnel ou CET</small></span><b aria-hidden="true">⌄</b></summary>
            <section className="request-option-group">
              <div className="type-tabs" role="group" aria-label="Autres types de congé">
                {(["childcare", "exceptional", "cet"] as SelectionType[]).map((type) => (
                  <button type="button" className={activeType === type ? "active" : ""} style={{ "--type-color": TYPE_COLORS[type] } as CSSProperties} onClick={() => setActiveType(type)} key={type}>
                    <i />{TYPE_LABELS[type]}{selectedCounts[type] ? <b>{selectedCounts[type]}</b> : null}
                  </button>
                ))}
              </div>
            </section>
          </details>
        </div>
        )
      ) : (
        <div className="request-option-groups request-option-groups-guided">
          <section className="request-option-group request-option-group-primary">
            <h3>Type de récupération</h3>
            <div className="type-tabs" role="group" aria-label="Choisir le type de récupération">
              {(["recovery_day", "recovery_half", "recovery_hours", "recovery_holiday", "recovery_training"] as SelectionType[]).map((type) => (
                <button type="button" className={activeType === type ? "active" : ""} style={{ "--type-color": TYPE_COLORS[type] } as CSSProperties} onClick={() => onSelectRecoveryType(type)} key={type}>
                  <i />{TYPE_LABELS[type]}{selectedCounts[type] ? <b>{selectedCounts[type]}</b> : null}
                </button>
              ))}
            </div>
          </section>
          <p className="request-selection-instruction">Touchez ensuite les dates concernées dans le planning. Les horaires utiles vous seront demandés automatiquement.</p>
        </div>
      )}
      {requestKind !== "strike" ? (
        <>
      {selectedList.length ? <div className="request-review-heading"><span className="step-label">Étape 3 sur 3</span><strong>Vérifiez avant d’enregistrer</strong></div> : null}
      <RequestValidationSummary
        items={selectedList}
        requestKind={requestKind}
        sickRequest={sickRequest}
        group={group}
        workQuota={workQuota}
        recoveryBalanceRemaining={recoveryBalanceRemaining}
        leaveRemaining={leaveRemainingByType}
      />
      <div className="request-bottom">
        {selectedList.length ? (
          <p><strong>{selectedList.length}</strong> {selectedList.length > 1 ? "dates sélectionnées" : "date sélectionnée"}. Touchez une date colorée pour la retirer.</p>
        ) : (
          <p><strong>Aucune date sélectionnée.</strong> Touchez une date dans le planning pour commencer.</p>
        )}
        <div className="request-actions">
          <button
            className="validate-button"
            type="button"
            onClick={onValidateAndOpenForm}
            disabled={!selectedList.length || savingRequest || selectionBlocked}
          >
            {savingRequest
              ? requestKind === "other" || sickRequest
                ? "Enregistrement…"
                : "Ouverture du formulaire…"
              : requestKind === "other"
                ? "Enregistrer Divers"
                : sickRequest
                  ? "Enregistrer l’arrêt maladie"
                  : "Enregistrer et préparer le formulaire"}
          </button>
          {requestKind !== "other" && !sickRequest ? (
            <button
              className="request-planning-choice"
              type="button"
              aria-label="Enregistrer uniquement"
              onClick={onSaveToPlanning}
              disabled={!selectedList.length || savingRequest || selectionBlocked}
            >
              <span aria-hidden="true">✓</span>
              <strong>Enregistrer uniquement</strong>
              <small>Sans formulaire</small>
            </button>
          ) : null}
        </div>
        {requestKind !== "other" && !sickRequest ? (
          <small className="request-action-clarification">
            Le formulaire est préparé, mais jamais envoyé automatiquement.
          </small>
        ) : null}
      </div>
        </>
      ) : null}
    </section>
  );
}
