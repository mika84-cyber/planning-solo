import { describe, expect, it } from "vitest";
import {
  isValidDateKey,
  MAX_CALENDAR_BODY_BYTES,
  normalizeBulkPeriods,
  readCalendarBody,
} from "./calendarValidation.mts";

describe("validation des dates de l'API", () => {
  it("accepte une date réelle au format ISO", () => {
    expect(isValidDateKey("2028-02-29")).toBe(true);
  });

  it("refuse les dates impossibles même si leur forme est correcte", () => {
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-04-31")).toBe(false);
  });
});

describe("lots de congés", () => {
  it("accepte Divers comme repère de planning", () => {
    const result = normalizeBulkPeriods([
      {
        id: "period-other-1",
        from: "2026-09-03",
        to: "2026-09-03",
        leaveType: "other",
        group: 2,
      },
    ]);
    expect(result).toMatchObject({
      periods: [{ leave_type: "other" }],
    });
  });

  it("normalise plusieurs dates avec des identifiants stables", () => {
    expect(
      normalizeBulkPeriods(
        [
          {
            id: "period-0001",
            from: "2026-09-02",
            to: "2026-09-02",
            leaveType: "annual",
            group: 2,
          },
          {
            id: "period-0002",
            from: "2026-09-04",
            to: "2026-09-04",
            leaveType: "half",
            halfMoment: "afternoon",
            group: 2,
          },
        ],
        "2026-08-20T19:23:00.000Z",
      ),
    ).toEqual({
      periods: [
        {
          id: "period-0001",
          from: "2026-09-02",
          to: "2026-09-02",
          leave_type: "annual",
          half_moment: "",
          group: 2,
          updated_at: "2026-08-20T19:23:00.000Z",
        },
        {
          id: "period-0002",
          from: "2026-09-04",
          to: "2026-09-04",
          leave_type: "half",
          half_moment: "afternoon",
          group: 2,
          updated_at: "2026-08-20T19:23:00.000Z",
        },
      ],
    });
  });

  it("refuse un doublon, une date impossible et un lot démesuré", () => {
    const valid = {
      id: "period-0001",
      from: "2026-09-02",
      to: "2026-09-02",
      leaveType: "annual",
      group: 2,
    };
    expect(normalizeBulkPeriods([valid, valid])).toHaveProperty("error");
    expect(
      normalizeBulkPeriods([{ ...valid, id: "period-0002", from: "2026-02-29" }]),
    ).toHaveProperty("error");
    expect(
      normalizeBulkPeriods(
        Array.from({ length: 401 }, (_, index) => ({
          ...valid,
          id: `period-${String(index).padStart(4, "0")}`,
        })),
      ),
    ).toHaveProperty("error");
  });
});

describe("taille et forme des requêtes", () => {
  it("lit un objet JSON valide", async () => {
    const result = await readCalendarBody(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ action: "save-entry" }),
      }),
    );
    expect(result).toEqual({ body: { action: "save-entry" } });
  });

  it("refuse un tableau et un JSON invalide", async () => {
    expect(
      await readCalendarBody(
        new Request("https://example.test", { method: "POST", body: "[]" }),
      ),
    ).toEqual({ error: "Requête invalide" });
    expect(
      await readCalendarBody(
        new Request("https://example.test", { method: "POST", body: "{" }),
      ),
    ).toEqual({ error: "Requête invalide" });
  });

  it("refuse un corps annoncé ou réellement trop volumineux", async () => {
    const announced = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": String(MAX_CALENDAR_BODY_BYTES + 1) },
      body: "{}",
    });
    expect(await readCalendarBody(announced)).toEqual({
      error: "Requête trop volumineuse",
    });

    const actual = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(MAX_CALENDAR_BODY_BYTES) }),
    });
    expect(await readCalendarBody(actual)).toEqual({
      error: "Requête trop volumineuse",
    });
  });
});
