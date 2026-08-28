import type { SharedGrandPalaisEvent } from "./grandPalaisProgramTypes";

export type GrandPalaisExceptionalClosure = {
  date: string;
  label: string;
};

/**
 * Fermetures exceptionnelles de toute la journée, vérifiées pour le Grand
 * Palais. Elles peuvent retirer une présence prévue des compteurs de travail,
 * mais ne modifient jamais la nature d'un congé, son solde ou la paie.
 */
export const GRAND_PALAIS_EXCEPTIONAL_CLOSURES: GrandPalaisExceptionalClosure[] = [
  { date: "2026-09-09", label: "Fermeture exceptionnelle du Grand Palais" },
  { date: "2026-09-10", label: "Fermeture exceptionnelle du Grand Palais" },
  { date: "2026-09-26", label: "Fermeture exceptionnelle du Grand Palais" },
];

const CLOSURE_BY_DATE = new Map(
  GRAND_PALAIS_EXCEPTIONAL_CLOSURES.map((closure) => [closure.date, closure]),
);

export function grandPalaisExceptionalClosure(
  date: string,
  approvedUpdates: SharedGrandPalaisEvent[] = [],
) {
  const approved = approvedUpdates.find((item) =>
    item.venueKey === "exceptional-closure"
    && !item.deleted
    && item.startDate <= date
    && date <= item.endDate,
  );
  return approved
    ? { date, label: approved.title }
    : CLOSURE_BY_DATE.get(date);
}
