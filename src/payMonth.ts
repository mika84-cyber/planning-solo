/**
 * Le cœur du calcul du brut mensuel.
 *
 * Ces fonctions viennent de `App.tsx`, où elles étaient mêlées à l'affichage
 * et donc hors de portée des tests. Les expressions n'ont pas été modifiées en
 * les déplaçant : elles sont recopiées à l'identique, y compris l'ordre des
 * additions, pour que les montants déjà affichés restent exactement les mêmes.
 *
 * **Le statut ne change aucune formule.** Maladie, grève et primes se
 * calculent à l'identique pour les fonctionnaires et les contractuels ; le
 * statut détermine seulement quelles lignes existent sur le bulletin, l'IFSE
 * et le CIA étant réservés aux fonctionnaires.
 *
 * L'application faisait deux exceptions, toutes deux fausses : elle mettait à
 * zéro la retenue maladie et la retenue de grève d'une personne contractuelle,
 * au motif que son arrêt relevait des IJSS et de la subrogation. Un bulletin
 * réel de contractuel du Centre Pompidou (février 2019, CDD art. 6 quater)
 * montre l'inverse : la ligne « Jour de carence 13/1/2019 » y est déduite de
 * −59,53 €, et le CUMUL BRUT de 1 802,54 € ne tombe juste qu'en la
 * retranchant. Ces exceptions surestimaient la paie sans le signaler ; la
 * retenue maladie est désormais calculée pour tout le monde par
 * `sickLeaveDeduction` dans planningLogic.ts.
 */

/**
 * La retenue de grève au 1/30, quel que soit le statut. `null` signifie que
 * l'estimation n'a pas pu être faite faute de traitement connu : on ne
 * retient alors rien plutôt que de deviner un montant.
 */
export function strikeDeduction(totalDeduction: number | null) {
  return totalDeduction ?? 0;
}

export type MonthGrossInputs = {
  /** Traitement de base, ou traitement indiciaire pour un fonctionnaire. */
  baseSalary: number;
  ifse: number;
  /** Somme des éléments fixes, indemnité de résidence comprise. */
  otherFixed: number;
  /** Le CIA du mois : déjà ramené à 0 sur les onze autres mois. */
  cia: number;
  /** Le douzième du forfait des dix premiers dimanches. */
  monthlyFlat: number;
  sunday: number;
  holiday: number;
  compensated: number;
  sickTotal: number;
  strikeDeduction: number;
  overtimeAmount: number;
  /** Mécénats du mois, déjà convertis en euros. */
  mecenatGross: number;
};

/**
 * Le brut du bulletin est la somme exacte de ces lignes : il est
 * reconstituable, contrairement au net qui supposerait de modéliser une
 * dizaine de cotisations.
 *
 * Il est scindé en deux pour l'estimation du net : le traitement porte la
 * pension civile, les primes n'y sont pas soumises et en gardent bien plus.
 */
export function monthGross(inputs: MonthGrossInputs) {
  return {
    premiums:
      inputs.monthlyFlat +
      inputs.sunday +
      inputs.holiday +
      inputs.compensated -
      inputs.sickTotal -
      inputs.strikeDeduction +
      inputs.mecenatGross,
    grossFixed:
      inputs.baseSalary +
      inputs.ifse +
      inputs.otherFixed -
      inputs.sickTotal -
      inputs.strikeDeduction,
    grossVariable:
      inputs.cia +
      inputs.monthlyFlat +
      inputs.sunday +
      inputs.holiday +
      inputs.compensated +
      inputs.overtimeAmount +
      inputs.mecenatGross,
    gross:
      inputs.baseSalary +
      inputs.ifse +
      inputs.otherFixed +
      inputs.cia +
      inputs.monthlyFlat +
      inputs.sunday +
      inputs.holiday +
      inputs.compensated -
      inputs.sickTotal -
      inputs.strikeDeduction +
      inputs.overtimeAmount +
      inputs.mecenatGross,
  };
}
