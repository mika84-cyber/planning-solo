import type { Dispatch, SetStateAction } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { GROUP_OPTIONS, YEAR_OPTIONS } from "./planningLogic";

type PdfScope = "selected" | "all" | "my-leaves" | "worked-holidays";

type PdfDownloadPageProps = {
  narrowScreen: boolean;
  year: number;
  group: number;
  showSchoolVacations: boolean;
  exporting: PdfScope | null;
  onYearChange: (year: number) => void;
  onGroupChange: (group: number) => void;
  onShowSchoolVacationsChange: Dispatch<SetStateAction<boolean>>;
  onExport: (scope: PdfScope, includeSchoolVacations: boolean) => void;
};

export function PdfDownloadPage({
  narrowScreen,
  year,
  group,
  showSchoolVacations,
  exporting,
  onYearChange,
  onGroupChange,
  onShowSchoolVacationsChange,
  onExport,
}: PdfDownloadPageProps) {
  return (
    <section className="pdf-download-screen" id="planning-pdf" aria-labelledby="pdf-download-title">
      <div className="native-screen-heading pdf-download-intro">
        <span className="step-label">Documents</span>
        <h2 id="pdf-download-title">Télécharger les plannings en PDF</h2>
        <p>
          {narrowScreen
            ? "Préparez votre planning, puis choisissez comment ouvrir ou télécharger le PDF."
            : "Préparez votre planning, puis choisissez la version à télécharger."}
        </p>
      </div>
      <section className="pdf-preparation-panel" aria-labelledby="pdf-preparation-title">
        <div className="pdf-panel-heading">
          <span className="pdf-step-number" aria-hidden="true">1</span>
          <div>
            <h3 id="pdf-preparation-title">Préparer le planning</h3>
            <p>Sélectionnez les informations qui figureront dans le document.</p>
          </div>
        </div>
        <div className="pdf-download-settings">
          <label>
            <span className="pdf-setting-title">
              <i aria-hidden="true">A</i>
              <span><b>Année du planning</b><small>Période du document</small></span>
            </span>
            <ChoicePicker
              value={year}
              options={YEAR_OPTIONS}
              onChange={onYearChange}
              ariaLabel="Sélectionner l’année du PDF"
              className="year-choice-picker"
            />
          </label>
          <label>
            <span className="pdf-setting-title">
              <i aria-hidden="true">G</i>
              <span><b>Groupe</b><small>Cycle de travail</small></span>
            </span>
            <ChoicePicker
              value={group}
              options={GROUP_OPTIONS}
              onChange={onGroupChange}
              ariaLabel="Sélectionner le groupe du PDF"
              className="year-choice-picker"
            />
          </label>
          <div className="school-vacation-choice">
            <button
              type="button"
              className={showSchoolVacations ? "school-vacation-toggle active" : "school-vacation-toggle"}
              aria-pressed={showSchoolVacations}
              onClick={() => onShowSchoolVacationsChange((current) => !current)}
            >
              <i aria-hidden="true" />
              <span>
                <strong>Vacances scolaires</strong>
                <small>Cocher la case pour intégrer les vacances scolaires au planning</small>
              </span>
            </button>
            {showSchoolVacations ? (
              <small className="pdf-option-confirmation">Les vacances scolaires seront ajoutées au document.</small>
            ) : null}
          </div>
        </div>
      </section>
      <section className="pdf-format-panel" aria-labelledby="pdf-format-title">
        <div className="pdf-panel-heading">
          <span className="pdf-step-number" aria-hidden="true">2</span>
          <div>
            <h3 id="pdf-format-title">Choisir le document</h3>
            <p>Le téléchargement démarre dès que le PDF est prêt.</p>
          </div>
        </div>
        <div className="pdf-download-actions">
          {([
            ["selected", "Mon groupe", `Planning annuel du groupe ${group}`, "1 page"],
            ["all", "Les 3 groupes", "Groupes 1, 2 et 3", "3 pages"],
            ["my-leaves", "Mon planning avec congés", `Groupe ${group} · absences enregistrées`, "1 page"],
            ["worked-holidays", "Fériés travaillés 2026–2031", "Pour faciliter les échanges entre groupe", "1 page"],
          ] as const).map(([scope, title, detail, pageCount]) => (
            <button
              key={scope}
              type="button"
              className={`pdf-action ${scope}`}
              disabled={exporting !== null}
              onClick={() => onExport(scope, scope === "worked-holidays" ? false : showSchoolVacations)}
            >
              <span className="pdf-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" /></svg>
              </span>
              <span className="pdf-action-copy">
                <span className="pdf-action-page-count">{pageCount}</span>
                <strong>{exporting === scope ? "Création…" : title}</strong>
                {detail ? <small>{detail}</small> : null}
                <span className="pdf-action-cta">Créer le PDF <i aria-hidden="true">→</i></span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
