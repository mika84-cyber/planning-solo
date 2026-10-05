import { type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, useEffect, useState } from "react";
import { GROUP_OPTIONS, YEAR_OPTIONS, workedHolidaysYearRange } from "./planningLogic";
import "./pdfDownloadPage.css";

type PdfScope = "selected" | "all" | "my-leaves" | "worked-holidays";

/** Couleurs des groupes, les mêmes que dans le choix du groupe. */
const GROUP_TONES: Record<number, string> = { 1: "#3069b4", 2: "#298b69", 3: "#ca772b" };

const DOC_ICONS: Record<PdfScope, ReactNode> = {
  selected: <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4m6-4v4" /></svg>,
  all: (
    <svg viewBox="0 0 24 24" className="pdf-doc-icon-groups">
      <rect x="4" y="4.5" width="16" height="4" rx="2" style={{ fill: GROUP_TONES[1] }} />
      <rect x="4" y="10" width="16" height="4" rx="2" style={{ fill: GROUP_TONES[2] }} />
      <rect x="4" y="15.5" width="16" height="4" rx="2" style={{ fill: GROUP_TONES[3] }} />
    </svg>
  ),
  "my-leaves": <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5m0 14v2.5M2.5 12H5m14 0h2.5M5.3 5.3l1.8 1.8m9.8 9.8 1.8 1.8m0-13.4-1.8 1.8m-9.8 9.8-1.8 1.8" /></svg>,
  "worked-holidays": <svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" /></svg>,
};

type PdfDownloadPageProps = {
  narrowScreen: boolean;
  year: number;
  /** Votre groupe : celui du PDF au départ, et celui de « Mon planning avec
   *  congés ». Le groupe choisi ici ne sert qu'au PDF et ne le change pas. */
  group: number;
  showSchoolVacations: boolean;
  exporting: PdfScope | null;
  onYearChange: (year: number) => void;
  onShowSchoolVacationsChange: Dispatch<SetStateAction<boolean>>;
  onExport: (scope: PdfScope, includeSchoolVacations: boolean, pdfGroup: number) => void;
};

export function PdfDownloadPage({
  narrowScreen,
  year,
  group,
  showSchoolVacations,
  exporting,
  onYearChange,
  onShowSchoolVacationsChange,
  onExport,
}: PdfDownloadPageProps) {
  const holidayYears = workedHolidaysYearRange();
  const firstYear = YEAR_OPTIONS[0].value;
  const lastYear = YEAR_OPTIONS[YEAR_OPTIONS.length - 1].value;
  // Le groupe du PDF part du vôtre et le suit s'il change ailleurs, mais le
  // choisir ici ne touche pas à votre groupe.
  const [pdfGroup, setPdfGroup] = useState(group);
  useEffect(() => setPdfGroup(group), [group]);
  return (
    <section className="pdf-download-screen" id="planning-pdf" aria-labelledby="pdf-download-title">
      <div className="native-screen-heading pdf-download-intro">
        <span className="step-label">Documents</span>
        <h2 id="pdf-download-title">Télécharger les plannings en PDF</h2>
        <p>
          {narrowScreen
            ? "Réglez l’année, le groupe et les vacances, puis touchez le document voulu."
            : "Réglez l’année, le groupe et les vacances, puis cliquez sur le document voulu."}
        </p>
      </div>
      {/* Une ligne de réglages, puis la liste des documents : un toucher crée
          le PDF. Chaque ligne rappelle les réglages qui la concernent. */}
      <section className="pdf-quick-settings" aria-label="Réglages du PDF">
        <div className="pdf-quick-setting pdf-quick-year">
          <span>Année</span>
          {/* Une année de plus ou de moins d'un toucher. */}
          <div className="pdf-year-stepper" role="group" aria-label="Année du PDF">
            <button type="button" aria-label="Année précédente" disabled={year <= firstYear} onClick={() => onYearChange(year - 1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
            </button>
            <strong aria-live="polite">{year}</strong>
            <button type="button" aria-label="Année suivante" disabled={year >= lastYear} onClick={() => onYearChange(year + 1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
            </button>
          </div>
        </div>
        <div className="pdf-quick-setting pdf-quick-group" style={{ "--setting-tone": GROUP_TONES[pdfGroup] } as CSSProperties}>
          <span>Groupe</span>
          {/* Les trois groupes d'un coup d'œil, chacun à sa couleur. */}
          <div className="pdf-group-pills" role="group" aria-label="Groupe du PDF">
            {GROUP_OPTIONS.map(({ value }) => (
              <button
                key={value}
                type="button"
                className={pdfGroup === value ? "active" : undefined}
                style={{ "--pill-tone": GROUP_TONES[value] } as CSSProperties}
                aria-pressed={pdfGroup === value}
                aria-label={`Groupe ${value}`}
                onClick={() => setPdfGroup(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="pdf-quick-setting pdf-quick-vacation">
          <span>Vacances</span>
          <button
            type="button"
            role="switch"
            className={showSchoolVacations ? "pdf-quick-switch active" : "pdf-quick-switch"}
            aria-checked={showSchoolVacations}
            aria-label="Ajouter les vacances scolaires au planning"
            onClick={() => onShowSchoolVacationsChange((current) => !current)}
          >
            <b>{showSchoolVacations ? "Oui" : "Non"}</b>
            <i aria-hidden="true" />
          </button>
        </div>
      </section>
      {/* Un filet discret sépare les réglages des documents. */}
      <div className="pdf-section-divider" aria-hidden="true"><span>Documents</span></div>
      <section className="pdf-doc-grid" aria-label="Documents à créer">
        {([
          // Du plus personnel au plus général : votre planning avec vos congés,
          // le même sans congés, les trois groupes, puis les fériés travaillés.
          ["my-leaves", "Mon planning avec mes congés", `Groupe ${group} · vos congés et absences de l’année`, "1 page", "#a4532f"],
          ["selected", pdfGroup === group ? "Mon planning sans congés" : `Planning du groupe ${pdfGroup}, sans congés`, `Groupe ${pdfGroup} · le cycle de travail seul`, "1 page", GROUP_TONES[pdfGroup]],
          ["all", "Planning des 3 groupes", "Groupes 1, 2 et 3 · une page par groupe", "3 pages", "#4a5a78"],
          ["worked-holidays", "Fériés travaillés par groupe", `${holidayYears.firstYear}–${holidayYears.lastYear} · pour échanger un férié entre groupes`, "1 page", "#8a4f9e"],
        ] as const).map(([scope, title, detail, pageCount, tone]) => {
          const settings = scope === "worked-holidays"
            ? "Sans vacances scolaires"
            : `${year}${showSchoolVacations ? " · vacances scolaires" : ""}`;
          return (
            <button
              key={scope}
              type="button"
              className={`pdf-doc pdf-doc-${scope}`}
              style={{ "--doc-tone": tone } as CSSProperties}
              disabled={exporting !== null}
              onClick={() => onExport(scope, scope === "worked-holidays" ? false : showSchoolVacations, pdfGroup)}
            >
              <span className="pdf-doc-icon" aria-hidden="true">{DOC_ICONS[scope]}</span>
              <span className="pdf-doc-copy">
                <strong>{exporting === scope ? "Création…" : title}</strong>
                <small>{detail}</small>
                <span className="pdf-doc-settings">{settings}</span>
              </span>
              <span className="pdf-doc-action">
                <span className="pdf-doc-download" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14" /></svg>
                </span>
                <span className="pdf-doc-pages">{pageCount}</span>
              </span>
            </button>
          );
        })}
      </section>
    </section>
  );
}
