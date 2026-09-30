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
