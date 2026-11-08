import { ChoicePicker } from "./ChoicePicker";
import { MONTHS } from "./planningLogic";

/** Le mois en tête du calendrier : « Novembre 2026 » est un seul bouton entre
 *  deux flèches, qui ouvre le panneau du mois au niveau de la fenêtre : le
 *  sélecteur des mois en mode panneau, avec l'année et ses flèches en tête et
 *  « Aujourd'hui » en pied. Toujours affiché depuis le 9 novembre 2026, et
 *  depuis le même jour le seul endroit où l'on change de période : la barre
 *  « mois, année, Aujourd'hui » de la carte Mon planning le doublait.
 *  `onStep` : −1 ou +1 mois. Les flèches de l'année agissent tout de suite
 *  et laissent le panneau ouvert ; un mois ou « Aujourd'hui » le ferment.
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
  return (
    <div className="month-card-nav">
      <button type="button" className="period-step" aria-label="Mois précédent" onClick={() => onStep(-1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
      </button>
      <div className="month-card-title" aria-live="polite">
        <ChoicePicker
          value={month}
          options={monthOptions(year, new Date())}
          onChange={(chosen) => onSelect(year, chosen)}
          ariaLabel="Mois du calendrier"
          className="month-card-picker"
          suffix={<span className="month-card-year">{year}</span>}
          panelLabel="Mois et année du calendrier"
          header={<MonthPanelYear year={year} onStep={(direction) => onSelect(year + direction, month)} />}
          footer={(close) => (
            <button
              type="button"
              className="month-period-today"
              onClick={() => {
                onToday();
                close();
              }}
            >
              Aujourd’hui
            </button>
          )}
          portal
        />
      </div>
      <button type="button" className="period-step" aria-label="Mois suivant" onClick={() => onStep(1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
      </button>
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
