import { euros } from "./appModel";
import {
  deductionSliceLabel,
  nextPayMonth,
  ofPayMonth,
  type DeductionSlice,
} from "./deductionPayMonth";
import "./deductionSources.css";

export type DeductionSourceLine = {
  slice: DeductionSlice;
  /** Montant retenu pour cette tranche ; `null` tant qu'il reste à chiffrer. */
  amount: number | null;
};

/** Pourquoi une tranche est retenue sur la paie affichée. */
export function deductionReason(slice: DeductionSlice, payMonth: string) {
  if (slice.overridden)
    return `Retenue déplacée sur cette paie ; la règle du 10 la plaçait sur celle ${ofPayMonth(slice.ruleMonth)}.`;
  return payMonth === slice.from.slice(0, 7)
    ? "Retenue le mois même : l’absence finit au plus tard le 10."
    : "Retenue sur la paie suivante : l’absence déborde après le 10.";
}

/** Les deux paies qui peuvent raisonnablement porter une tranche : celle du
 *  mois de l'absence et la suivante. La paie affichée n'est pas proposée. */
export function deductionMoveTargets(slice: DeductionSlice, payMonth: string) {
  const lived = slice.from.slice(0, 7);
  return [lived, nextPayMonth(lived)].filter((month) => month !== payMonth);
}

/** Retenues maladie et grève de la paie affichée, une ligne par tranche,
 *  chacune déplaçable si le bulletin reçu ne suit pas la règle du 10. */
export function DeductionSources({
  payMonth,
  sources,
  onMove,
}: {
  payMonth: string;
  sources: DeductionSourceLine[];
  onMove: (slice: DeductionSlice, payMonth: string) => void;
}) {
  if (!sources.length) return null;
  return (
    <section className="deduction-sources" aria-labelledby="deduction-sources-title">
      <h4 id="deduction-sources-title">Retenues de cette paie</h4>
      <p>
        La paie est arrêtée vers le 10 : une absence qui déborde après le 10 est en général retenue
        le mois suivant. Si votre bulletin dit autre chose, déplacez-la.
      </p>
      <ul>
        {sources.map(({ slice, amount }) => (
          <li key={slice.key} data-overridden={slice.overridden || undefined}>
            <div>
              <strong>{deductionSliceLabel(slice)}</strong>
              <small>{deductionReason(slice, payMonth)}</small>
            </div>
            {amount === null ? null : <b>−{euros(amount)}</b>}
            <div className="deduction-sources-actions">
              {deductionMoveTargets(slice, payMonth).map((month) => (
                <button key={month} type="button" onClick={() => onMove(slice, month)}>
                  {slice.overridden && month === slice.ruleMonth
                    ? "Revenir à la règle du 10"
                    : `Déplacer sur la paie ${ofPayMonth(month)}`}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
