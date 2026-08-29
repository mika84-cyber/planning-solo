import { describe, expect, it } from "vitest";
import { parseCalendarSnapshot } from "./calendarPayload";

describe("parseCalendarSnapshot", () => {
  it("convertit les unités serveur et conserve les données valides", () => {
    const snapshot = parseCalendarSnapshot({
      email: "agent@example.com",
      entries: [{ date: "2026-09-03", note_text: "Note", leave: true }],
      periods: [{ id: "p1", from: "2026-09-03", to: "2026-09-04", leave_type: "annual", updated_at: "u" }],
      overtime_entries: [{ id: "h1", date: "2026-09-01", minutes: 60, day_minutes: 60, night_minutes: 0, disposition: "paid", input_mode: "duration" }],
      recovery_uses: [{ id: "r1", date: "2026-09-02", minutes: 180, kind: "training" }],
      mecenat_entries: [{ id: "m1", date: "2026-09-05", start: "20:00", end: "23:00", day_minutes: 120, night_minutes: 60, gross_amount_cents: 7500, pay_year: 2026, pay_month: 8 }],
      form_profile: {
        full_name: "Agent",
        group: "2",
        signature: "A",
        base_salary_cents: 250_000,
        pay_profiles: { 2026: { cia_cents: 12_000, cia_month: 7 } },
      },
    });

    expect(snapshot.email).toBe("agent@example.com");
    expect(snapshot.entries["2026-09-03"].leave).toBe(true);
    expect(snapshot.periods[0]).toMatchObject({ leaveType: "annual", updatedAt: "u" });
    expect(snapshot.formProfile?.baseSalary).toBe(2500);
    expect(snapshot.payProfiles["2026"]).toMatchObject({ cia: 120, ciaMonth: 7 });
    expect(snapshot.overtimeEntries[0].disposition).toBe("paid");
    expect(snapshot.recoveryUses[0].kind).toBe("training");
    expect(snapshot.mecenatEntries[0].grossAmountCents).toBe(7500);
  });

  it("écarte les lignes mal formées et applique des valeurs sûres", () => {
    const snapshot = parseCalendarSnapshot({
      entries: [{ date: "incorrecte" }, null],
      periods: [{ id: "p", from: "x", to: "y" }],
      overtime_entries: [{ id: "", date: "2026-01-01" }],
      form_profile: "invalide",
    });

    expect(snapshot.email).toBe("Compte connecté");
    expect(snapshot.entries).toEqual({});
    expect(snapshot.periods).toEqual([]);
    expect(snapshot.overtimeEntries).toEqual([]);
    expect(snapshot.formProfile).toBeNull();
  });
});
