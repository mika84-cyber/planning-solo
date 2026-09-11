import { useRef } from "react";

type Props = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onDeleteAll: () => void;
};

export function DataManagementDialog({
  open,
  busy,
  onClose,
  onExport,
  onImport,
  onDeleteAll,
}: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-card data-management-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-management-title"
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          disabled={busy}
        >
          ×
        </button>
        <span className="step-label">Mon compte</span>
        <h2 id="data-management-title">Mes données</h2>
        <p className="data-management-intro">Tout est enregistré automatiquement. Vous n’avez rien à faire.</p>
        <div className="data-management-actions">
          <button type="button" onClick={onExport} disabled={busy}>
            <strong>Sauvegarder une copie</strong>
            <small>Pour la garder sur votre appareil</small>
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <strong>Reprendre une copie</strong>
            <small>Choisir une sauvegarde précédente</small>
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) onImport(file);
            }}
          />
        </div>
        <details className="data-management-more">
          <summary>Effacer mes données</summary>
          <div className="data-management-actions data-management-advanced-actions">
            <button
              className="danger-data-button"
              type="button"
              onClick={onDeleteAll}
              disabled={busy}
            >
              <strong>Tout effacer définitivement</strong>
              <small>Planning, paie et réglages seront supprimés</small>
            </button>
          </div>
          <p className="data-management-hint">Une confirmation vous sera demandée.</p>
        </details>
      </section>
    </div>
  );
}
