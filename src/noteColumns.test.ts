import { describe, expect, it } from "vitest";
import { splitNoteItemsIntoColumns } from "./noteColumns";

describe("colonnes chronologiques de notes", () => {
  it("place les cinq premières notes à gauche puis poursuit à droite", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ id: index }));
    const [left, right] = splitNoteItemsIntoColumns(items);
    expect(left.map((item) => item.id)).toEqual([0, 1, 2, 3, 4]);
    expect(right.map((item) => item.id)).toEqual([5, 6, 7]);
  });

  it("garde entière une double note qui franchit la cinquième place", () => {
    const items = [
      { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 },
      { id: 4, notes: ["Mika", "Agnès"] }, { id: 5 },
    ];
    const [left, right] = splitNoteItemsIntoColumns(items);
    expect(left.map((item) => item.id)).toEqual([0, 1, 2, 3, 4]);
    expect(right.map((item) => item.id)).toEqual([5]);
  });
});
