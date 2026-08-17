import { useRef } from "react";

type Props = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onArchiveLegacy: () => void;
  onDeleteAll: () => void;
};

export function DataManagementDialog({
  open,
  busy,
  onClose,
  onExport,
  onImport,
  onArchiveLegacy,
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
        <span className="step-label">Confidentialité</span>
        <h2 id="data-management-title">Gérer mes données</h2>
        <p>
          Téléchargez une sauvegarde réimportable avant une opération importante.
          Le fichier contient le planning, le profil et les paramètres de paie :
          conservez-le dans un emplacement privé.
        </p>
        <div className="data-management-actions">
          <button type="button" onClick={onExport} disabled={busy}>
            Exporter une sauvegarde JSON
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            Restaurer une sauvegarde
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
          <button type="button" onClick={onArchiveLegacy} disabled={busy}>
            Archiver les anciennes données
          </button>
          <button
            className="danger-data-button"
            type="button"
            onClick={onDeleteAll}
            disabled={busy}
          >
            Effacer toutes mes données
          </button>
        </div>
        <p className="data-management-hint">
          L’archivage déplace les anciennes clés globales dans votre espace privé.
          La suppression complète exige de taper le mot SUPPRIMER.
        </p>
        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            data-modal-close
            onClick={onClose}
            disabled={busy}
          >
            Fermer
          </button>
        </div>
      </section>
    </div>
  );
}
