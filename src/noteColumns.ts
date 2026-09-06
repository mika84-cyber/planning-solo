export type NoteColumnItem = {
  notes?: readonly unknown[];
};

/** Remplit d'abord la colonne de gauche avec cinq notes. Une journée reste
 * indivisible : si sa double note commence en cinquième position, les deux
 * contenus restent à gauche avant de poursuivre dans la colonne de droite. */
export function splitNoteItemsIntoColumns<T>(
  items: readonly T[],
  leftCapacity = 5,
) {
  let used = 0;
  let splitAt = items.length;
  for (let index = 0; index < items.length; index++) {
    if (used >= leftCapacity) {
      splitAt = index;
      break;
    }
    used += Math.max(1, (items[index] as T & NoteColumnItem).notes?.length || 0);
  }
  return [items.slice(0, splitAt), items.slice(splitAt)] as const;
}
