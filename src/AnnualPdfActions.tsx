import type { AnnualPdfScope } from "./useAnnualPdfExport";

export type AnnualPdfActionsProps = {
  narrowScreen: boolean;
  pdfOpen: boolean;
  onTogglePdfOpen: () => void;
  showSchoolVacationsOnPdf: boolean;
  onToggleSchoolVacations: () => void;
  pdfExporting: AnnualPdfScope | null;
  group: number;
  onExport: (scope: AnnualPdfScope, includeSchoolVacations: boolean) => void;
};

/** Les trois plannings annuels à imprimer, proposés depuis la vue Année. */
export function AnnualPdfActions({
  narrowScreen,
  pdfOpen,
  onTogglePdfOpen,
  showSchoolVacationsOnPdf,
  onToggleSchoolVacations,
  pdfExporting,
  group,
  onExport,
}: AnnualPdfActionsProps) {
  return (
      <section
        id="planning-pdf"
        className="annual-pdf-actions"
      aria-label="Enregistrer le planning annuel en PDF"
    >
      {narrowScreen ? (
        <button
          className="request-archive-toggle annual-pdf-toggle"
          type="button"
          onClick={onTogglePdfOpen}
          aria-expanded={pdfOpen}
        >
          <span className="request-archive-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
            </svg>
          </span>
          <span className="request-archive-copy">
            <span className="step-label">Exports PDF</span>
            <strong>Plannings annuels</strong>
            <small>3 formats prêts à imprimer</small>
          </span>
          <span className="request-archive-caret" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </span>
        </button>
      ) : (
        <div className="annual-pdf-heading">
          <span className="step-label">Exports PDF</span>
          <small>Plannings annuels prêts à imprimer</small>
        </div>
      )}
      <div
        className="annual-pdf-buttons"
        hidden={narrowScreen && !pdfOpen}
      >
        <div className="school-vacation-choice">
          <button
            type="button"
            className={
              showSchoolVacationsOnPdf
                ? "school-vacation-toggle active"
                : "school-vacation-toggle"
            }
            aria-pressed={showSchoolVacationsOnPdf}
            onClick={onToggleSchoolVacations}
          >
            <i aria-hidden="true" />
            Afficher les vacances scolaires
          </button>
          {showSchoolVacationsOnPdf && (
            <small>Zones A, B et C incluses dans le récapitulatif.</small>
          )}
        </div>
        <button
          type="button"
          className="pdf-action selected-group"
          disabled={pdfExporting !== null}
          onClick={() => onExport("selected", showSchoolVacationsOnPdf)}
        >
          <span className="pdf-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
            </svg>
          </span>
          <span className="pdf-action-copy">
            <strong>
              {pdfExporting === "selected"
                ? "Création…"
                : `Groupe ${group}`}
            </strong>
            <small>1 page</small>
          </span>
        </button>
        <button
          type="button"
          className="pdf-action all-groups"
          disabled={pdfExporting !== null}
          onClick={() => onExport("all", showSchoolVacationsOnPdf)}
        >
          <span className="pdf-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
            </svg>
          </span>
          <span className="pdf-action-copy">
            <strong>
              {pdfExporting === "all" ? "Création…" : "Les 3 groupes"}
            </strong>
            <small>3 pages</small>
          </span>
        </button>
        <button
          type="button"
          className="pdf-action my-leaves"
          disabled={pdfExporting !== null}
          onClick={() => onExport("my-leaves", showSchoolVacationsOnPdf)}
        >
          <span className="pdf-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" />
            </svg>
          </span>
          <span className="pdf-action-copy">
            <strong>
              {pdfExporting === "my-leaves"
                ? "Création…"
                : `Groupe ${group} + mes congés`}
            </strong>
            <small>1 page</small>
          </span>
        </button>
      </div>
    </section>
  );
}
