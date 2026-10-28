import { describe, expect, it } from "vitest";
import { emptyEntry, type Entries, type PartnerCalendarEntries } from "./appModel";
import { noteSearchItems, upcomingNoteItems } from "./useNoteLists";

const note = (text: string, groupId = "") => ({ ...emptyEntry(), noteText: text, noteGroupId: groupId });
const agnes = (text: string, groupId = ""): PartnerCalendarEntries[string] => ({
  noteText: text, noteColor: "#f2c84b", noteAuthor: "agnes", noteUpdatedAt: "", noteGroupId: groupId, agnesLeave: false,
});

describe("notes à venir", () => {
  const entries: Entries = {
    "2026-11-02": note("Vacances chez maman", "g1"),
    "2026-11-03": note("Vacances chez maman", "g1"),
    "2026-11-04": note("Vacances chez maman", "g1"),
    "2026-11-06": note("Dentiste"),
    "2026-10-20": note("Passée"),
  };
  const partner: PartnerCalendarEntries = {
    "2026-11-03": agnes("Coiffeur", "a1"),
    "2026-11-04": agnes("Coiffeur", "a1"),
  };

  it("mentionne chaque jour d’une note posée sur plusieurs jours, de Mika comme d’Agnès", () => {
    const items = upcomingNoteItems(entries, partner, "2026-11-01", true);
    expect(items.map((item) => item.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-06"]);
    // Le 3 et le 4 réunissent la note de Mika et celle d'Agnès ; chaque jour
    // garde la période de sa note en détail.
    expect(items[1].notes?.map((item) => item.author)).toEqual(["mika", "agnes"]);
    expect(items[0].detail).toBe(items[2].detail);
    expect(items[3].notes?.map((item) => item.label)).toEqual(["Dentiste"]);
    // Les notes passées n'y sont pas ; sans notes affichées, rien.
    expect(items.some((item) => item.date === "2026-10-20")).toBe(false);
    expect(upcomingNoteItems(entries, partner, "2026-11-01", false)).toEqual([]);
  });

  it("la recherche liste aussi chaque jour, passés compris", () => {
    const found = noteSearchItems(entries, partner, "maman");
    expect(found.map((item) => item.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(noteSearchItems(entries, partner, "pass").map((item) => item.date)).toEqual(["2026-10-20"]);
    expect(noteSearchItems(entries, partner, "coiffeur").map((item) => item.date)).toEqual(["2026-11-03", "2026-11-04"]);
    expect(noteSearchItems(entries, partner, "  ")).toEqual([]);
  });
});
