/** Un écart constaté sur le bulletin, et ce que la personne peut en faire.
 *
 *  Chaque écart a ses explications probables ; plutôt que de les lire, on
 *  propose le geste qui va avec : appliquer le taux d'imposition du
 *  bulletin, enregistrer le montant qu'il porte, reporter un mécénat pas
 *  encore payé sur la paie suivante, passer en fonctionnaire quand le
 *  bulletin porte une IFSE… Le module décide des choix ; l'écran les
 *  affiche et les actions de paie les exécutent. */
import { euros } from "./appModel";
import { matchEarlyPayment } from "./earlyPayment";
import type { MecenatEntry } from "./mecenat";
import type { PayslipReviewCheck } from "./payslipReview";
import { MONTHS, s } from "./planningLogic";
import type { PayDraftKey } from "./usePayUiState";

export type PayslipGapAction =
  | { kind: "save-amount"; field: PayDraftKey; value: number }
  | { kind: "defer-mecenats"; entries: MecenatEntry[]; year: number; month: number }
  | { kind: "report-sundays"; count: number }
  | { kind: "set-status"; status: "fonctionnaire" }
  | { kind: "open-holiday-choices" };

export type PayslipGapChoice = {
  id: string;
  /** Le bouton : le geste, en quelques mots. */
  label: string;
  /** Ce que ce geste change, et pourquoi il explique sans doute l'écart. */
  detail: string;
  action: PayslipGapAction;
};

export type PayslipGapContext = {
  /** Le mois du bulletin. */
  year: number;
  month: number;
  /** Les mécénats que l'estimation attend sur cette paie. */
  mecenatLines: MecenatEntry[];
  /** Ce que le bulletin paie de mécénat, lu sur ses lignes. */
  bulletinMecenatCents: number;
  /** La paie primée suivante, où des dimanches non payés se reportent. */
  nextSundayPayout: { year: number; month: number } | null;
  /** Fériés travaillés dont la compensation reste à décider. */
  holidayPending: number;
};

const AMOUNT_FIELDS: Partial<Record<string, { field: PayDraftKey; what: string }>> = {
  base: { field: "baseSalary", what: "le traitement de base" },
  ifse: { field: "ifse", what: "l’IFSE" },
  "other-fixed": { field: "otherFixed", what: "les autres éléments fixes" },
  cia: { field: "cia", what: "le CIA" },
  navigo: { field: "navigo", what: "le Navigo remboursé" },
  "meal-vouchers": { field: "mealVoucherDeduction", what: "la retenue des titres repas" },
};

const monthLabel = (year: number, month: number) => `${MONTHS[month]} ${year}`;

/** Les mécénats attendus sur cette paie que le bulletin n'a pas payés :
 *  tous, quand il n'en porte aucun ; ceux que le montant lu n'explique pas,
 *  quand il en paie une partie. */
export function unpaidMecenats(lines: MecenatEntry[], bulletinCents: number) {
  if (!lines.length) return [];
  if (bulletinCents <= 0) return lines;
  const { matched } = matchEarlyPayment(lines, (entry) => entry.grossAmountCents, bulletinCents);
  const paid = new Set(matched.map((entry) => entry.id));
  return matched.length ? lines.filter((entry) => !paid.has(entry.id)) : [];
}

export function payslipGapChoices(issue: PayslipReviewCheck, context: PayslipGapContext): PayslipGapChoice[] {
  const { found, expected } = issue;
  const when = monthLabel(context.year, context.month);
  const next = context.month === 11 ? { year: context.year + 1, month: 0 } : { year: context.year, month: context.month + 1 };

  if (issue.key === "pas-rate" && found !== undefined) {
    return [{
      id: "apply-pas-rate",
      label: `Appliquer le taux du bulletin : ${found.toLocaleString("fr-FR")} %`,
      detail: `Les impôts l’ont sans doute actualisé. L’estimation suivra ce taux à partir de ${when} ; l’ancien reste valable avant.`,
      action: { kind: "save-amount", field: "pasRate", value: found },
    }];
  }

  const amountField = AMOUNT_FIELDS[issue.key];
  if (amountField && found !== undefined && found >= 0) {
    return [{
      id: `apply-${amountField.field}`,
      label: `Enregistrer ${euros(found)} dans le profil`,
      detail: `L’application attendait ${euros(expected)} pour ${amountField.what} ; le bulletin fait foi, à partir de ${when}.`,
      action: { kind: "save-amount", field: amountField.field, value: found },
    }];
  }

  if (issue.key === "status") {
    return [{
      id: "set-fonctionnaire",
      label: "Passer mon statut en Fonctionnaire",
      detail: "Un contractuel ne perçoit ni IFSE ni CIA : ce bulletin en porte. L’IFSE et le CIA entreront alors dans l’estimation.",
      action: { kind: "set-status", status: "fonctionnaire" },
    }];
  }

  if (issue.key === "sundays" && found !== undefined && found < expected && context.nextSundayPayout) {
    const count = Math.round(expected - found);
    const target = context.nextSundayPayout;
    return [{
      id: "report-sundays",
      label: `Reporter ${count} dimanche${s(count)} sur ${monthLabel(target.year, target.month)}`,
      detail: "Pas encore payé" + s(count) + ", sans doute pour un délai de traitement : l’estimation les attendra sur la paie primée suivante.",
      action: { kind: "report-sundays", count },
    }];
  }

  if (issue.key === "holidays" && found !== undefined && found < expected) {
    return [{
      id: "holiday-choices",
      label: "Revoir la compensation des fériés",
      detail: context.holidayPending
        ? `${context.holidayPending} férié${s(context.holidayPending)} à décider : choisissez prime ou récupération, et l’estimation suivra.`
        : "Un férié choisi en prime a pu être pris en récupération, ou être payé le mois suivant, en rappel « R ».",
      action: { kind: "open-holiday-choices" },
    }];
  }

  if (issue.key === "gross" && found !== undefined && found < expected) {
    const unpaid = unpaidMecenats(context.mecenatLines, context.bulletinMecenatCents);
    if (unpaid.length) {
      const total = unpaid.reduce((sum, entry) => sum + entry.grossAmountCents, 0) / 100;
      const several = unpaid.length > 1;
      return [{
        id: "defer-mecenats",
        label: `Reporter ${several ? `les ${unpaid.length} mécénats` : "le mécénat"} sur ${monthLabel(next.year, next.month)}`,
        detail: `${euros(total)} de mécénat ${several ? "étaient attendus" : "était attendu"} sur cette paie et n’y ${several ? "sont" : "est"} pas : ${several ? "ils seront comptés" : "il sera compté"} sur la paie suivante.`,
        action: { kind: "defer-mecenats", entries: unpaid, year: next.year, month: next.month },
      }];
    }
  }

  return [];
}
