import { ChoicePicker } from "./ChoicePicker";
import { MONTHS } from "./planningLogic";

/** Le mois en tête du calendrier : « Novembre 2026 » à gauche ouvre le panneau
 *  du mois (année et douze mois), et une capsule unique à droite réunit
 *  Mois précédent, Aujourd'hui et Mois suivant.
 *  `onStep` : −1 ou +1 mois. Les flèches de l'année agissent tout de suite
 *  et laissent le panneau ouvert ; un mois le ferme.
 *  Dans son propre fichier, à dessein : PlanningView est aussi chargé par des
 *  modules différés (HomeDashboard, WorkExchangeDatePicker) ; y importer le
 *  sélecteur sortait react-dom et jsx-runtime dans des morceaux à part, soit
 *  1,6 Kio de JavaScript de plus au total. Et c'est le seul emploi du
 *  sélecteur au chargement initial : sans lui, Rolldown sort ChoicePicker dans
 *  un morceau à part (2,7 Kio de plus au total). */
export function MonthNavigation({
  year,
  month,
  onStep,
  onSelect,
  onToday,
}: {
  year: number;
  month: number;
  onStep: (direction: -1 | 1) => void;
  /** Un mois du panneau, ou l'année précédente ou suivante : la vue suit tout
   *  de suite. */
  onSelect: (year: number, month: number) => void;
  onToday: () => void;
}) {
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  return (
    <div className="month-card-nav">
      <div className="month-card-title" aria-live="polite">
        <ChoicePicker
          value={month}
          options={monthOptions(year, today)}
          onChange={(chosen) => onSelect(year, chosen)}
          ariaLabel="Mois du calendrier"
          className="month-card-picker"
          suffix={<span className="month-card-year">{year}</span>}
          panelLabel="Mois et année du calendrier"
          header={<MonthPanelYear year={year} onStep={(direction) => onSelect(year + direction, month)} />}
          portal
        />
      </div>
      <div className="month-card-controls">
        <button type="button" className="period-step" aria-label="Mois précédent" onClick={() => onStep(-1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
        </button>
        <button
          type="button"
          className={`month-nav-today${isCurrentMonth ? " is-current" : ""}`}
          onClick={onToday}
        >
          Aujourd’hui
        </button>
        <button type="button" className="period-step" aria-label="Mois suivant" onClick={() => onStep(1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
        </button>
      </div>
    </div>
  );
}

/** Les douze mois du panneau, dans l'année affichée : celui d'aujourd'hui est
 *  marqué (cerclé par le style quand il n'est pas le mois affiché). */
export function monthOptions(year: number, today: Date) {
  return MONTHS.map((label, value) => {
    const current = year === today.getFullYear() && value === today.getMonth();
    return { value, label, current, className: current ? "today-month" : undefined };
  });
}

/** En tête du panneau : l'année entre ses deux flèches. */
export function MonthPanelYear({ year, onStep }: { year: number; onStep: (direction: -1 | 1) => void }) {
  return (
    <div className="month-period-year">
      <button type="button" aria-label="Année précédente" onClick={() => onStep(-1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
      </button>
      <strong>{year}</strong>
      <button type="button" aria-label="Année suivante" onClick={() => onStep(1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
      </button>
    </div>
  );
}
