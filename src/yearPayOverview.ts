import { roundCurrency } from "./appModel";

/**
 * L'année de paie en un coup d'œil : douze mois, du brut au net, avec les
 * primes, les mécénats et l'impôt. Un mois dont le bulletin a été vérifié
 * prend le brut et le net avant impôt réels lus sur le bulletin ; les autres
 * mois gardent l'estimation, avec les mêmes formules que la paie du mois
 * (voir useMonthPayEstimate). Les mois à venir sont des estimations plus
 * incertaines : ils se distinguent.
 */
export type YearPayMonthInput = {
  index: number;
  /** Le brut du mois et ses parties ; `null` tant que le traitement n'est pas connu. */
  estimate: {
    gross: number;
    grossFixed: number;
    grossVariable: number;
    /** Dimanches, fériés et fériés compensés (forfait compris). */
    premiums: number;
    mecenat: number;
  } | null;
  /** Les taux et retenues du mois ; `null` tant que les taux ne sont pas renseignés. */
  ratios: {
    netRatioFixed: number;
    netRatioVariable: number;
    navigo: number;
    mealVoucherDeduction: number;
    pasRate: number;
    pasBaseAdjustment: number;
  } | null;
  /** Le bulletin vérifié du mois, s'il y en a un. */
  real?: { gross: number; netBeforeTax: number };
};

export type YearPayMonth = {
  index: number;
  gross: number | null;
  premiums: number;
  mecenat: number;
  netBeforeTax: number | null;
  tax: number | null;
  net: number | null;
  /** Montants lus sur le bulletin plutôt qu'estimés. */
  verified: boolean;
  /** Paie pas encore versée à la date du jour. */
  future: boolean;
};

export type YearPayOverview = {
  year: number;
  months: YearPayMonth[];
  totals: { gross: number; premiums: number; mecenat: number; tax: number; net: number };
  verifiedCount: number;
  /** Mois dont le net a pu être calculé ou lu. */
  knownCount: number;
};

export function yearPayOverview(year: number, inputs: YearPayMonthInput[], today: Date): YearPayOverview {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const months: YearPayMonth[] = Array.from({ length: 12 }, (_, index) => {
    const input = inputs.find((item) => item.index === index);
    const estimate = input?.estimate ?? null;
    const ratios = input?.ratios ?? null;
    const real = input?.real;
    const future = year > todayYear || (year === todayYear && index > todayMonth);
    const premiums = estimate?.premiums ?? 0;
    const mecenat = estimate?.mecenat ?? 0;
    // Le net : cotisations d'abord, avec les deux taux, puis Navigo et titres
    // repas (jamais en décembre), puis l'impôt sur le net imposable.
    let netBeforeTax: number | null = real ? real.netBeforeTax : null;
    if (netBeforeTax === null && estimate && ratios) {
      const netFromGross = roundCurrency(
        estimate.grossFixed * (ratios.netRatioFixed / 100) + estimate.grossVariable * (ratios.netRatioVariable / 100),
      );
      const mealVouchers = index === 11 ? 0 : ratios.mealVoucherDeduction;
      netBeforeTax = roundCurrency(netFromGross + ratios.navigo - mealVouchers);
    }
    const tax = netBeforeTax !== null && ratios ? roundCurrency(netBeforeTax * (ratios.pasRate / 100) * ratios.pasBaseAdjustment) : null;
    const net = netBeforeTax !== null && tax !== null ? roundCurrency(netBeforeTax - tax) : null;
    return {
      index,
      gross: real ? real.gross : estimate?.gross ?? null,
      premiums,
      mecenat,
      netBeforeTax,
      tax,
      net,
      verified: Boolean(real),
      future,
    };
  });
  const known = months.filter((month) => month.net !== null);
  const total = (pick: (month: YearPayMonth) => number | null) =>
    roundCurrency(known.reduce((sum, month) => sum + (pick(month) ?? 0), 0));
  return {
    year,
    months,
    totals: {
      gross: total((month) => month.gross),
      premiums: total((month) => month.premiums),
      mecenat: total((month) => month.mecenat),
      tax: total((month) => month.tax),
      net: total((month) => month.net),
    },
    verifiedCount: months.filter((month) => month.verified).length,
    knownCount: known.length,
  };
}
