import { describe, expect, it } from "vitest";
import {
  isValidDateKey,
  MAX_CALENDAR_BODY_BYTES,
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
