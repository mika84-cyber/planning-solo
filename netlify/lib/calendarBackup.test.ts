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
      overtime_entries: [
        {
          id: "overtime-1234",
          date: "2026-08-18",
          minutes: 90,
          day_minutes: 60,
          night_minutes: 30,
          disposition: "paid",
          input_mode: "range",
          start: "21:30",
          end: "23:00",
        },
      ],
      recovery_uses: [
        {
          id: "recovery-1234",
          date: "2026-08-20",
          minutes: 60,
        },
      ],
      mecenat_entries: [
        {
          id: "mecenat-1234",
          date: "2026-09-12",
          start: "19:00",
          end: "00:00",
          day_minutes: 180,
          night_minutes: 120,
          gross_amount_cents: 13870,
          pay_year: 2026,
          pay_month: 9,
        },
      ],
      form_profile: {
        full_name: "Agnès",
        group: "2",
        status: "contractuel",
        work_quota: "three_quarters",
        signature: "",
        manual_adjustments: {
          "2026": {
            annual_used: 4.5,
            rtt_used: 2,
            fraction_used: 1,
            sunday_leave_jan_jun: 2,
            sunday_leave_jul_sep: 1,
            sunday_leave_oct_nov: 0,
            sunday_leave_dec: 1,
          },
        },
      },
    });
    expect(result).toHaveProperty("backup");
    if ("backup" in result) {
      expect(result.backup!.entries[0]).toMatchObject({
        date: "2026-08-17",
        note_text: "Réunion",
      });
      expect(result.backup!.overtime_entries[0]).toMatchObject({
        minutes: 90,
        night_minutes: 30,
      });
      expect(result.backup!.recovery_uses[0].minutes).toBe(60);
      expect(result.backup!.mecenat_entries[0]).toMatchObject({
        day_minutes: 180,
        night_minutes: 120,
        gross_amount_cents: 13870,
      });
      expect(result.backup!.form_profile?.work_quota).toBe("three_quarters");
      expect(
        result.backup!.form_profile?.manual_adjustments?.["2026"],
      ).toMatchObject({
        annual_used: 4.5,
        sunday_leave_jan_jun: 2,
        sunday_leave_dec: 1,
      });
    }
  });

  it("reste compatible avec une ancienne sauvegarde sans heures supplémentaires", () => {
    const result = sanitizeCalendarBackup({
      version: 1,
      entries: [],
      periods: [],
      form_profile: null,
    });
    expect(result).toHaveProperty("backup");
    if ("backup" in result) {
      expect(result.backup!.overtime_entries).toEqual([]);
      expect(result.backup!.recovery_uses).toEqual([]);
      expect(result.backup!.mecenat_entries).toEqual([]);
    }
  });

  it("utilise Contractuel au premier usage sans écraser un choix enregistré", () => {
    const firstUse = sanitizeCalendarBackup({
      version: 1,
      entries: [],
      periods: [],
      form_profile: { full_name: "", group: "2", signature: "" },
    });
    const savedChoice = sanitizeCalendarBackup({
      version: 1,
      entries: [],
      periods: [],
      form_profile: {
        full_name: "",
        group: "2",
        signature: "",
        status: "fonctionnaire",
      },
    });
    expect("backup" in firstUse && firstUse.backup?.form_profile?.status).toBe(
      "contractuel",
    );
    expect(
      "backup" in savedChoice && savedChoice.backup?.form_profile?.status,
    ).toBe("fonctionnaire");
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
