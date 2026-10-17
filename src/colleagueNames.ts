import { normalizeSearchText } from "./searchMatching";

/** Le compte de l'annuaire qui correspond à un nom de la liste des groupes.
 *  Le nom public peut être le nom complet, le prénom seul ou le prénom et
 *  une initiale (« Camille D. ») ; un doute entre deux comptes ne tranche pas. */
export function findColleagueAccount<T extends { displayName: string }>(name: string, directory: readonly T[]): T | null {
  const tokens = (value: string) => normalizeSearchText(value).split(" ").filter(Boolean);
  const wanted = tokens(name);
  if (!wanted.length) return null;
  const matches = directory.filter((person) => {
    const own = tokens(person.displayName);
    if (!own.length) return false;
    if (own.join(" ") === wanted.join(" ")) return true;
    return own.every((token) => {
      const initial = token.replace(/\.$/, "");
      return wanted.includes(token) || (initial.length === 1 && wanted.some((word) => word.startsWith(initial)));
    });
  });
  return matches.length === 1 ? matches[0] : null;
}

/** Nom affiché dans les plannings partagés : le prénom, ou le surnom choisi
 *  dans l'annuaire — le premier mot du nom public. « Adriana Lecroulant »
 *  devient « Adriana », « Nikky » reste « Nikky ». */
export function planningFirstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || displayName.trim();
}

/** Les noms courts d'une liste de collègues. Deux personnes au même prénom
 *  gardent l'initiale de leur nom (« Marie D. », « Marie L. ») pour rester
 *  distinguables dans le même tableau. */
export function planningFirstNames(people: Array<{ id: string; name: string }>) {
  const counts = new Map<string, number>();
  for (const person of people) {
    const key = planningFirstName(person.name).toLocaleLowerCase("fr");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries(people.map((person) => {
    const first = planningFirstName(person.name);
    const second = person.name.trim().split(/\s+/)[1];
    const shared = (counts.get(first.toLocaleLowerCase("fr")) || 0) > 1;
    return [person.id, shared && second ? `${first} ${second.charAt(0).toLocaleUpperCase("fr")}.` : first];
  })) as Record<string, string>;
}
