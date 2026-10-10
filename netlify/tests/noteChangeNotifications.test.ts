import { describe, expect, it, vi } from "vitest";
import {
  describeNoteChange,
  diffNotes,
  noteTargets,
  notifyNoteChanges,
  touchesNotes,
} from "../lib/noteChangeNotifications.mts";

describe("notifications des notes", () => {
  it("ne suit que les écritures qui touchent une note", () => {
    expect(touchesNotes({ action: "save-period", id: "x" })).toBe(false);
    expect(touchesNotes({ action: "save-entry", date: "2026-10-17" })).toBe(true);
    expect(touchesNotes({ action: "batch", operations: [{ action: "save-overtime" }, { action: "delete-note-period", groupId: "g1" }] })).toBe(true);
  });

  it("relit les dates et les groupes concernés", () => {
    expect(noteTargets({ action: "save-note-period", from: "2026-10-17", to: "2026-10-19", groupId: "g1" })).toEqual({
      dates: ["2026-10-17", "2026-10-18", "2026-10-19"],
      groups: ["g1"],
    });
  });

  it("réunit une note sur plusieurs jours en un seul message", () => {
    const after = Object.fromEntries(["2026-10-17", "2026-10-18", "2026-10-19"].map((date) => [date, { text: "Stage", groupId: "g1" }]));
    const changes = diffNotes({}, after);
    expect(changes).toEqual([{ kind: "added", from: "2026-10-17", to: "2026-10-19", text: "Stage", previousText: "" }]);
    expect(describeNoteChange(changes[0])).toMatchObject({
      title: "Mika a ajouté une note",
      body: "Du 17 oct. au 19 oct. : Stage",
    });
  });

  it("dit l'ancien texte d'une note modifiée et celui d'une note annulée", () => {
    const changes = diffNotes(
      { "2026-10-17": { text: "Médecin 9 h", groupId: "" }, "2026-10-20": { text: "Colis", groupId: "" } },
      { "2026-10-17": { text: "Médecin 10 h", groupId: "" } },
    );
    expect(changes.map((change) => describeNoteChange(change))).toMatchObject([
      { title: "Mika a modifié une note", body: "Le sam. 17 oct. : Médecin 10 h (avant : Médecin 9 h)" },
      { title: "Mika a annulé une note", body: "Le mar. 20 oct. : Colis" },
    ]);
  });

  it("n'envoie rien quand le texte ne change pas, et un envoi raté ne casse rien", async () => {
    expect(diffNotes({ "2026-10-17": { text: "A", groupId: "" } }, { "2026-10-17": { text: "A", groupId: "" } })).toEqual([]);
    const send = vi.fn().mockRejectedValue(new Error("hors ligne"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyNoteChanges(diffNotes({}, { "2026-10-17": { text: "A", groupId: "" } }), send)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ recipients: ["agnes"] });
  });
});
