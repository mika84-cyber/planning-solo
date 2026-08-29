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
          closure_override: "closed",
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
        pay_profiles: {
          "2026": { base_salary_cents: 180173 },
          "2026-08": {
            base_salary_cents: 180173,
            residence_allowance_cents: 5405,
          },
        },
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
        cet_account: {
          enabled: true,
          employer: "public-establishment",
          employer_name: "Centre Pompidou",
          category: "B",
          work_rule: "visitor_service",
          has_one_year_service: true,
          is_trainee: false,
          opened_on: "2025-01-02",
          initial_balance: 12,
          legacy_cap_70: false,
          operations: [
            {
              id: "cet-operation-1234",
              date: "2026-12-01",
              kind: "deposit",
              days: 3,
              source: "rtt",
              note: " Relevé RH ",
            },
          ],
        },
      },
    });
    expect(result).toHaveProperty("backup");
    if ("backup" in result) {
      const backup = result.backup;
      expect(backup).toBeDefined();
      if (!backup) return;
      expect(backup.entries[0]).toMatchObject({
        date: "2026-08-17",
        note_text: "Réunion",
        closure_override: "closed",
      });
      expect(backup.overtime_entries[0]).toMatchObject({
        minutes: 90,
        night_minutes: 30,
      });
      expect(backup.recovery_uses[0].minutes).toBe(60);
      expect(backup.mecenat_entries[0]).toMatchObject({
        day_minutes: 180,
        night_minutes: 120,
        gross_amount_cents: 13870,
      });
      expect(backup.form_profile?.work_quota).toBe("three_quarters");
      expect(backup.form_profile?.pay_profiles?.["2026-08"]).toMatchObject({
        base_salary_cents: 180173,
        residence_allowance_cents: 5405,
      });
      expect(
        backup.form_profile?.manual_adjustments?.["2026"],
      ).toMatchObject({
        annual_used: 4.5,
        sunday_leave_jan_jun: 2,
        sunday_leave_dec: 1,
      });
      expect(backup.form_profile?.cet_account).toMatchObject({
        employer_name: "Centre Pompidou",
        category: "B",
        work_rule: "visitor_service",
        has_one_year_service: true,
        is_trainee: false,
        initial_balance: 12,
        operations: [{ kind: "deposit", source: "rtt", note: "Relevé RH" }],
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
      const backup = result.backup;
      expect(backup).toBeDefined();
      if (!backup) return;
      expect(backup.overtime_entries).toEqual([]);
      expect(backup.recovery_uses).toEqual([]);
      expect(backup.mecenat_entries).toEqual([]);
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

  it("refuse un historique CET incohérent", () => {
    expect(
      sanitizeCalendarBackup({
        version: 1,
        entries: [],
        periods: [],
        form_profile: {
          full_name: "",
          group: "2",
          signature: "",
          cet_account: {
            employer: "public-establishment",
            category: "A",
            initial_balance: 5,
            operations: [
              { id: "cet-operation-1234", date: "2026-13-01", kind: "leave", days: 1 },
            ],
          },
        },
      }),
    ).toHaveProperty("error");
  });
});
