import { MONTHS } from "./planningLogic";

type PayMonthNavProps = {
  month: number;
  year: number;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  /** L'identifiant du titre, quand la carte s'en sert pour se nommer. */
  titleId?: string;
  heading?: "h2" | "h3";
};

/** Le mois de paie, une flèche de chaque côté : le même navigateur en tête
 *  de Ma paie, des primes et du détail du calcul. « Revenir à aujourd’hui »
 *  ne paraît que loin du mois en cours. */
export function PayMonthNav({ month, year, onPreviousMonth, onNextMonth, onToday, titleId, heading: Heading = "h2" }: PayMonthNavProps) {
  const label = MONTHS[month].charAt(0).toUpperCase() + MONTHS[month].slice(1);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  return (
    <div className="pay-bulletin-month pay-bulletin-month-nav" role="group" aria-label="Choisir le mois de paie">
      <button type="button" className="pay-bulletin-month-arrow" onClick={onPreviousMonth} aria-label="Mois précédent">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
      </button>
      <div className="pay-bulletin-month-title">
        <span className="pay-bulletin-kicker">Paie de</span>
        <Heading id={titleId}>{label} {year}</Heading>
        {isCurrentMonth ? null : <button type="button" className="pay-bulletin-today" onClick={onToday}>Revenir à aujourd’hui</button>}
      </div>
      <button type="button" className="pay-bulletin-month-arrow" onClick={onNextMonth} aria-label="Mois suivant">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
      </button>
    </div>
  );
}
