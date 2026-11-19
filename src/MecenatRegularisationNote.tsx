import { euros } from "./appModel";
import { MECENAT_NIGHT_REGULARISATION, type pendingNightMajoration } from "./mecenat";
import { minutesLabel } from "./overtime";
import { MONTHS, s } from "./planningLogic";

/** « novembre 2026 » pour « 2026-11-01 » ou « 2026-11 ». */
function monthOf(key: string) {
  return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/** La majoration de 22 h à minuit des mécénats déjà faits, que la paie a
 *  versée au tarif jour, et ce qu'on en sait : la DRH reprendra les états
 *  début 2027, pour les heures depuis le 1er janvier 2024 ; pour celles
 *  d'octobre 2026, la date n'est pas connue ; depuis novembre 2026, la paie
 *  verse la majoration. Rien à régulariser : rien ne s'affiche. */
export function MecenatRegularisationNote({ pending }: { pending: ReturnType<typeof pendingNightMajoration> }) {
  if (!pending.cents) return null;
  const { expected, paidFrom, undecidedFrom } = MECENAT_NIGHT_REGULARISATION;
  const onlyUndecided = (pending.firstDate ?? "") >= undecidedFrom;
  const someUndecided = (pending.lastDate ?? "") >= undecidedFrom;
  const undecided = monthOf(undecidedFrom);
  const payMonth = MONTHS[Number(paidFrom.payMonth.slice(5, 7)) - 1];
  return (
    <section className="mecenat-regularisation" aria-labelledby="mecenat-regularisation-title">
      <span className="mecenat-regularisation-kicker">À régulariser{onlyUndecided ? "" : ` · ${expected}`}</span>
      <h4 id="mecenat-regularisation-title"><strong>{euros(pending.cents / 100)}</strong> de majoration de nuit</h4>
      <p>
        {minutesLabel(pending.minutes)} de 22 h à minuit sur {pending.count} mécénat{s(pending.count)}, payée{pending.minutes > 60 ? "s" : ""} au tarif jour.{" "}
        {onlyUndecided
          ? `Pour ${undecided}, la date de la régularisation n’est pas encore connue.`
          : `La DRH reprendra les états ${expected}, pour les heures faites depuis le 1er janvier 2024${someUndecided ? ` ; pour celles ${/^[aeiou]/.test(undecided) ? "d’" : "de "}${undecided}, la date n’est pas encore connue` : ""}.`}
      </p>
      <p>
        Les mécénats faits depuis le 1er{"\u00a0"}{monthOf(paidFrom.date)} sont payés au barème, majoration comprise, à partir de la paie {/^[aeiou]/.test(payMonth) ? "d’" : "de "}{payMonth}.
      </p>
    </section>
  );
}
