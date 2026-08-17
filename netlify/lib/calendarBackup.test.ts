import { describe, expect, it } from "vitest";
import { sanitizeCalendarBackup } from "./calendarBackup.mts";

describe("restauration d'une sauvegarde", () => {
  it("valide et nettoie une sauvegarde complète", () => {
    const result = sanitizeCalendarBackup({
      version: 1,
      entries: [
        {
          date: "2026-08-17",
          note_text: "  Réunion  ",
          note_color: "#7358d8",
          leave: false,
        },
      ],
      periods: [
        {
          id: "period-1234",
          from: "2026-08-18",
          to: "2026-08-20",
          leave_type: "annual",
        },
      ],
      form_profile: {
        full_name: "Agnès",
        group: "2",
        status: "contractuel",
        signature: "",
      },
    });
    expect(result).toHaveProperty("backup");
    if ("backup" in result)
      expect(result.backup!.entries[0]).toMatchObject({
        date: "2026-08-17",
        note_text: "Réunion",
      });
  });

  it("refuse les dates, doublons et versions inconnues", () => {
    expect(sanitizeCalendarBackup({ version: 2, entries: [], periods: [] })).toHaveProperty(
      "error",
    );
    expect(
      sanitizeCalendarBackup({
        version: 1,
        entries: [
          { date: "2026-02-30" },
          { date: "2026-02-30" },
        ],
        periods: [],
      }),
    ).toHaveProperty("error");
  });
});
