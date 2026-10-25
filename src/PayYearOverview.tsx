import { ChoicePicker } from "./ChoicePicker";
import { euros } from "./appModel";
import { MONTHS, YEAR_OPTIONS } from "./planningLogic";
import type { YearPayOverview } from "./yearPayOverview";
import "./payYear.css";

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * L'année en un coup d'œil : le net perçu et les totaux de l'année, le net
 * mois par mois en barres, puis les douze mois en tableau — chacun s'ouvre
 * sur le détail de son calcul. Un mois vérifié avec son bulletin porte une
 * coche ; un mois à venir reste une estimation, plus claire.
 */
export function PayYearOverview({
  overview,
  onYearChange,
  onOpenMonth,
}: {
  overview: YearPayOverview;
  onYearChange: (year: number) => void;
  onOpenMonth: (month: number) => void;
}) {
  const { year, months, totals, verifiedCount, knownCount } = overview;
  const gross = totals.gross;
  const share = (value: number) => (gross > 0 ? Math.min(100, Math.round((Math.abs(value) / gross) * 100)) : 0);
  const maxNet = Math.max(0, ...months.map((month) => month.net ?? 0));
  const rows = [
    { key: "gross", label: "Brut", note: "traitement, indemnités et primes", value: euros(totals.gross), kind: "" },
    { key: "premiums", label: "Primes", note: "dimanches, fériés, forfait", value: euros(totals.premiums), kind: "plus", amount: totals.premiums },
    ...(totals.mecenat ? [{ key: "mecenat", label: "Mécénats", note: "payés le mois suivant", value: euros(totals.mecenat), kind: "plus", amount: totals.mecenat }] : []),
    { key: "tax", label: "Impôt sur le revenu", note: "prélevé à la source", value: `− ${euros(totals.tax)}`, kind: "minus", amount: totals.tax },
    { key: "net", label: "Net perçu", note: knownCount < 12 ? `sur ${knownCount} mois connus` : "les douze mois", value: euros(totals.net), kind: "net", amount: totals.net },
  ];
  return (
    <section className="pay-year" aria-labelledby="pay-year-title">
      <div className="pay-year-head">
        <label className="pay-year-picker">
          <span>Année</span>
          <ChoicePicker value={year} options={YEAR_OPTIONS} onChange={onYearChange} ariaLabel="Choisir l’année de paie" className="leave-year-picker" />
        </label>
        <p className="pay-year-status">
          {verifiedCount
            ? `${verifiedCount} mois vérifié${verifiedCount > 1 ? "s" : ""} avec le bulletin`
            : "Estimations d’après votre profil"}
        </p>
      </div>
      <h3 id="pay-year-title" className="pay-totals-kicker">L’année {year}</h3>
      <ol className="pay-year-totals">
        {rows.map((row) => (
          <li key={row.key} className={row.kind || undefined}>
            <span className="pay-year-label">{row.label}<small>{row.note}</small></span>
            <b>{row.value}</b>
            <span className="pay-total-bar" aria-hidden="true"><i style={{ width: `${share("amount" in row ? (row.amount as number) : totals.gross)}%` }} /></span>
          </li>
        ))}
      </ol>

      {/* Le net mois par mois : une barre par mois, le plus haut à 100 %. */}
      <div className="pay-year-chart" role="img" aria-label={`Net mois par mois en ${year}`}>
        {months.map((month) => (
          <span key={month.index} className={`pay-year-bar${month.future ? " future" : ""}${month.verified ? " verified" : ""}${month.net === null ? " unknown" : ""}`}>
            <i style={{ height: `${maxNet > 0 && month.net !== null ? Math.max(4, Math.round((month.net / maxNet) * 100)) : 0}%` }} />
            <small>{capitalized(MONTHS[month.index]).slice(0, 1)}</small>
          </span>
        ))}
      </div>

      <table className="pay-year-table">
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col">Brut</th>
            <th scope="col">Impôt</th>
            <th scope="col">Net</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.index} className={`${month.future ? "future" : ""}${month.verified ? " verified" : ""}`.trim() || undefined}>
              <th scope="row">
                <button type="button" onClick={() => onOpenMonth(month.index)} aria-label={`${capitalized(MONTHS[month.index])} ${year}${month.verified ? ", vérifié avec le bulletin" : ""} : voir le détail du calcul`}>
                  {capitalized(MONTHS[month.index])}
                  {month.verified ? <em aria-hidden="true">✓</em> : null}
                </button>
              </th>
              <td>{month.gross === null ? "—" : euros(month.gross)}</td>
              <td className="minus">{month.tax === null ? "—" : `− ${euros(month.tax)}`}</td>
              <td className="net">{month.net === null ? "—" : euros(month.net)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{euros(totals.gross)}</td>
            <td className="minus">− {euros(totals.tax)}</td>
            <td className="net">{euros(totals.net)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="pay-year-note">
        Les mois à venir sont des estimations ; une coche marque un mois vérifié avec son bulletin. Touchez un mois pour voir son calcul.
      </p>
    </section>
  );
}
