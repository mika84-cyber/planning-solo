import { euros } from "./appModel";
import type { PayAllowancesModel } from "./PayAllowancesSection";
import { MONTHS, SUNDAY_ALLOWANCE, s, sundayPayslip } from "./planningLogic";

/** Le détail des dimanches de l'année, groupés par paie puis par mois : une
 *  pastille par dimanche, à la couleur de ce qu'il rapporte. */
export function SundayDetailsList({ allowances, onClose }: { allowances: PayAllowancesModel; onClose: () => void }) {
  const sundaysDone = allowances.sundays.filter((item) => item.past);
  return (
    <div id="sunday-done-list" className="sunday-done-list">
      {allowances.sundays.length ? (
        <>
          {/* Le rang d'un dimanche dit ce qu'il rapporte : les dix
              premiers sont dans le forfait mensuel, les suivants sont
              payés un par un jusqu'au plafond, au-delà rien. */}
          <p className="sunday-done-legend">
            <span className="paid">Payé {euros(SUNDAY_ALLOWANCE.perSunday)}</span>
            <span className="flat">Forfait</span>
            {allowances.monthly?.some((slot) => slot.reported) ? <span className="carried">Reporté</span> : null}
            {allowances.sundays.length > SUNDAY_ALLOWANCE.paidUntil ? <span className="unpaid">Non payé</span> : null}
            {allowances.sundays.length > sundaysDone.length ? <span className="upcoming">À venir</span> : null}
          </p>
          {/* Groupés par paie, puis par mois : c'est ainsi qu'on les
              retrouve sur un bulletin, et la liste tient en quelques lignes. */}
          {[...new Set(allowances.sundays.map((item) => sundayPayslip(item.key).label))].map((payslipLabel) => {
            const paid = allowances.sundays.filter((item) => sundayPayslip(item.key).label === payslipLabel);
            // Les dimanches de l'année sont dans l'ordre : leur place est leur rang.
            const rankOf = (item: (typeof paid)[number]) => allowances.sundays.indexOf(item) + 1;
            const firstRank = rankOf(paid[0]);
            const lastRank = rankOf(paid[paid.length - 1]);
            const kindOf = (rank: number) =>
              rank <= SUNDAY_ALLOWANCE.flatUntil ? "flat" : rank <= SUNDAY_ALLOWANCE.paidUntil ? "paid" : "unpaid";
            const paidSundays = paid.filter((item) => kindOf(rankOf(item)) === "paid");
            // Un report passe les derniers dimanches payables de cette paie
            // sur la suivante, et ceux de la précédente arrivent ici : la
            // liste suit ainsi l'estimation de chaque paie.
            const order = sundayPayslip(paid[0].key).order;
            const slot = order < 3 ? allowances.monthly?.find((item) => item.index === [6, 9, 11][order]) : undefined;
            const reported = Math.min(slot?.reported || 0, paidSundays.length);
            const carried = slot?.carryover || 0;
            const reportedKeys = new Set(paidSundays.slice(paidSundays.length - reported).map((item) => item.key));
            const kept = paidSundays.filter((item) => !reportedKeys.has(item.key));
            const paidHere = kept.length + carried;
            const paidUpcoming = kept.filter((item) => !item.past).length;
            const moves = `${reported && slot?.reportedTo ? ` · ${reported} reporté${s(reported)} sur ${MONTHS[slot.reportedTo.month]}` : ""}${
              carried && slot?.carriedFrom ? ` · dont ${carried} reporté${s(carried)} ${/^[aeio]/.test(MONTHS[slot.carriedFrom.month]) ? "d’" : "de "}${MONTHS[slot.carriedFrom.month]}` : ""
            }`;
            const hasFlat = paid.some((item) => kindOf(rankOf(item)) === "flat");
            // Le montant de la paie, en pastille à droite du titre : vert s'il
            // est acquis, en pointillé s'il reste à venir.
            const amountTone = paidHere ? (paidUpcoming === paidHere ? "upcoming" : "paid") : hasFlat ? "flat" : "unpaid";
            const amountLabel = paidHere ? euros(paidHere * SUNDAY_ALLOWANCE.perSunday) : hasFlat ? "Forfait" : "0 €";
            return (
              <section className="sunday-done-group" key={payslipLabel}>
                <div className="sunday-done-group-heading">
                  <span>
                    <strong>{payslipLabel.charAt(0).toUpperCase() + payslipLabel.slice(1)}</strong>
                    <small>{paid.length} dimanche{s(paid.length)} · n° {firstRank}{lastRank > firstRank ? ` à ${lastRank}` : ""}</small>
                  </span>
                  <b className={`sunday-done-group-amount ${amountTone}`}>{amountLabel}</b>
                </div>
                <p className={`sunday-done-group-pay${paidHere ? "" : hasFlat ? " none" : " unpaid"}`}>
                  {reported && !paidHere
                    ? `Aucun payé sur cette paie${moves}`
                    : paidHere
                    ? `${paidHere} payé${s(paidHere)} sur cette paie${
                        paidUpcoming
                          ? paidUpcoming === paidHere
                            ? " · à venir"
                            : ` · ${paidHere - paidUpcoming} fait${s(paidHere - paidUpcoming)}, ${paidUpcoming} à venir`
                          : ""
                      }${moves}`
                    : hasFlat
                      ? "Tous compris dans le forfait mensuel"
                      : `Au-delà du ${SUNDAY_ALLOWANCE.paidUntil}e dimanche : non payés`}
                </p>
                <table className="allowance-table sunday-done-table">
                  <tbody>
                    {[...new Set(paid.map((item) => Number(item.key.slice(5, 7)) - 1))].map((monthIndex) => {
                      const days = paid.filter((item) => Number(item.key.slice(5, 7)) - 1 === monthIndex);
                      return (
                        <tr key={monthIndex}>
                          <th scope="row">{MONTHS[monthIndex]}</th>
                          <td>
                            {/* Un dimanche, une pastille à la couleur de ce qu'il
                                rapporte ; en pointillé tant qu'il est à venir. */}
                            <span className="sunday-chips">
                              {days.map((item) => {
                                const rank = rankOf(item);
                                const kind = kindOf(rank);
                                const moved = reportedKeys.has(item.key) && slot?.reportedTo;
                                return (
                                  <span
                                    key={item.key}
                                    className={`sunday-day ${kind}${moved ? " carried" : ""}${item.past ? "" : " upcoming"}`}
                                    title={`${rank}${rank === 1 ? "er" : "e"} dimanche · ${moved ? `reporté sur ${MONTHS[moved.month]} ${moved.year}` : kind === "paid" ? "payé" : kind === "flat" ? "dans le forfait" : "non payé"}${item.past ? "" : " · à venir"}`}
                                  >
                                    {Number(item.key.slice(8, 10))}
                                  </span>
                                );
                              })}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </>
      ) : (
        <p className="allowance-note">
          Aucun dimanche travaillé pour le moment.
        </p>
      )}
      <button className="sunday-dates-close" type="button" onClick={onClose}>
        Masquer les dates
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
      </button>
    </div>
  );
}
