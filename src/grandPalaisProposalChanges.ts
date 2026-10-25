import type { GrandPalaisPrice, SharedGrandPalaisEvent } from "./grandPalaisProgramTypes";

/**
 * Ce qui a changé entre la version gardée d'une exposition et celle que la
 * veille vient de lire : le titre, la précision, les dates, l'espace, et
 * chaque tarif — ancien → nouveau. Une proposition « Informations
 * modifiées » se décide ainsi sans avoir à se souvenir de l'ancien prix.
 */
export type ProposalChange = {
  label: string;
  /** `null` : la valeur n'existait pas (un tarif ajouté). */
  before: string | null;
  /** `null` : la valeur a disparu (un tarif retiré). */
  after: string | null;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const frenchDate = (value: string) => dateFormat.format(new Date(`${value}T12:00:00Z`));
const amount = (price: GrandPalaisPrice) =>
  price.amount === 0 ? "gratuit" : `${price.amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
const priceKey = (price: GrandPalaisPrice) => `${price.group ?? ""}|${price.label}`;
const priceName = (price: GrandPalaisPrice) => (price.group ? `${price.group} · ${price.label}` : price.label);

export function proposalChanges(previous: SharedGrandPalaisEvent, next: SharedGrandPalaisEvent): ProposalChange[] {
  const changes: ProposalChange[] = [];
  const text = (label: string, before: string | undefined, after: string | undefined) => {
    if ((before ?? "") !== (after ?? "")) changes.push({ label, before: before || null, after: after || null });
  };
  text("Titre", previous.title, next.title);
  text("Précision", previous.details, next.details);
  if (previous.startDate !== next.startDate) changes.push({ label: "Début", before: frenchDate(previous.startDate), after: frenchDate(next.startDate) });
  if (previous.endDate !== next.endDate) changes.push({ label: "Fin", before: frenchDate(previous.endDate), after: frenchDate(next.endDate) });
  text("Espace", previous.venueLabel, next.venueLabel);
  // Les tarifs, rapprochés par grille et par libellé : un tarif modifié, ajouté
  // ou retiré.
  const before = new Map((previous.prices ?? []).map((price) => [priceKey(price), price]));
  const after = new Map((next.prices ?? []).map((price) => [priceKey(price), price]));
  for (const [key, price] of after) {
    const old = before.get(key);
    if (!old) changes.push({ label: priceName(price), before: null, after: amount(price) });
    else if (old.amount !== price.amount) changes.push({ label: priceName(price), before: amount(old), after: amount(price) });
  }
  for (const [key, price] of before)
    if (!after.has(key)) changes.push({ label: priceName(price), before: amount(price), after: null });
  return changes;
}
