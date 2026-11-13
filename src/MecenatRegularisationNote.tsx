import { euros } from "./appModel";
import { MECENAT_NIGHT_REGULARISATION, type pendingNightMajoration } from "./mecenat";
import { minutesLabel } from "./overtime";
import { s } from "./planningLogic";

/** La majoration de 22 h à minuit des mécénats déjà faits, que la paie verse
 *  encore au tarif jour, et ce que la DRH en a dit : reprise des états début
 *  2027, pour toutes les heures depuis le 1er janvier 2024, et rien sur la
 *  paie de décembre 2026. Rien à régulariser : rien ne s'affiche. */
export function MecenatRegularisationNote({ pending, todayKey }: { pending: ReturnType<typeof pendingNightMajoration>; todayKey: string }) {
  if (!pending.cents) return null;
  return (
    <section className="mecenat-regularisation" aria-labelledby="mecenat-regularisation-title">
      <span className="mecenat-regularisation-kicker">À régulariser · {MECENAT_NIGHT_REGULARISATION.expected}</span>
      <h4 id="mecenat-regularisation-title"><strong>{euros(pending.cents / 100)}</strong> de majoration de nuit</h4>
      <p>
        {minutesLabel(pending.minutes)} de 22 h à minuit sur {pending.count} mécénat{s(pending.count)}, payée{pending.minutes > 60 ? "s" : ""} au tarif jour.
        La DRH reprendra les états {MECENAT_NIGHT_REGULARISATION.expected}, pour toutes les heures depuis le 1er janvier 2024
        {todayKey < "2027-01-01" ? " ; la paie de décembre ne la régularisera pas." : "."}
      </p>
    </section>
  );
}
