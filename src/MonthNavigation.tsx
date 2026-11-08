import { ChoicePicker } from "./ChoicePicker";
import { MONTH_OPTIONS } from "./planningLogic";

/** Le mois en tête du calendrier : « Novembre 2026 » est un seul bouton, le
 *  sélecteur du mois (la liste s'ouvre au niveau de la fenêtre) avec l'année
 *  en complément ; deux flèches l'encadrent. Toujours affiché depuis le
 *  9 novembre 2026 ; avant, seulement pendant une demande, quand le panneau
 *  séparait la barre du mois de la grille et qu'on ne savait plus quel mois on
 *  touchait. `onStep` : −1 ou +1 mois.
 *  Dans son propre fichier, à dessein : PlanningView est aussi chargé par des
 *  modules différés (HomeDashboard, WorkExchangeDatePicker) ; y importer le
 *  sélecteur sortait react-dom et jsx-runtime dans des morceaux à part, soit
 *  1,6 Kio de JavaScript de plus au total. */
export function MonthNavigation({
  year,
  month,
  onStep,
  onSelectMonth,
}: {
  year: number;
  month: number;
  onStep: (direction: -1 | 1) => void;
  onSelectMonth: (month: number) => void;
}) {
  return (
    <div className="month-card-nav">
      <button type="button" className="period-step" aria-label="Mois précédent" onClick={() => onStep(-1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
      </button>
      <div className="month-card-title" aria-live="polite">
        <ChoicePicker
          value={month}
          options={MONTH_OPTIONS}
          onChange={onSelectMonth}
          ariaLabel="Mois du calendrier"
          className="month-card-picker"
          suffix={<span className="month-card-year">{year}</span>}
          portal
        />
      </div>
      <button type="button" className="period-step" aria-label="Mois suivant" onClick={() => onStep(1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
      </button>
    </div>
  );
}
