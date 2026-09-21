import { describe, expect, it } from "vitest";
import { mecenatRuleViolations, type MecenatDayPresence, type MecenatRuleContext } from "./mecenatRules";

/** Semaine de test : lundi 21 septembre 2026 au dimanche 27. */
function context(
  presence: Record<string, MecenatDayPresence["status"] | MecenatDayPresence>,
  mecenats: MecenatRuleContext["mecenats"] = [],
): MecenatRuleContext {
  return {
    presenceFor: (key) => {
      const value = presence[key] ?? "rest";
      return typeof value === "string" ? { status: value } : value;
    },
    schedule: { start: "09:15", end: "17:30" },
    mecenats,
  };
}

describe("règles du mécénat", () => {
  it("accepte une soirée courte après une journée de travail", () => {
    expect(mecenatRuleViolations(
      { date: "2026-09-23", start: "18:00", end: "21:00" },
      context({ "2026-09-23": "work", "2026-09-24": "work" }),
    )).toEqual([]);
  });

  it("refuse plus de 12 heures entre la prise de poste et le départ", () => {
    const [reason] = mecenatRuleViolations(
      { date: "2026-09-23", start: "19:00", end: "23:00" },
      context({ "2026-09-23": "work" }),
    );
    expect(reason).toContain("Amplitude de 13 h 45");
    expect(reason).toContain("de 9 h 15 (prise de poste) à 23 h");
    expect(reason).toContain("12 heures au maximum");
  });

  it("refuse une vacation seule de plus de 12 heures un jour de repos", () => {
    expect(mecenatRuleViolations(
      { date: "2026-09-26", start: "10:00", end: "23:00" },
      context({}),
    )[0]).toContain("Amplitude de 13 h");
  });

  it("exige 11 heures de repos avant la prise de poste du lendemain", () => {
    const reasons = mecenatRuleViolations(
      { date: "2026-09-26", start: "18:00", end: "01:00" },
      context({ "2026-09-27": "work" }),
    );
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("finir à 1 h dans la nuit");
    expect(reasons[0]).toContain("que 8 h 15 avant votre prise de poste du dimanche 27 septembre à 9 h 15");
  });

  it("exige 11 heures de repos après la journée de la veille", () => {
    const [reason] = mecenatRuleViolations(
      { date: "2026-09-26", start: "03:00", end: "08:00" },
      context({ "2026-09-25": "work" }),
    );
    expect(reason).toContain("vous terminez à 17 h 30 le vendredi 25 septembre");
    expect(reason).toContain("9 h 30 avant de commencer à 3 h");
  });

  it("compte aussi un mécénat déjà enregistré la veille", () => {
    const [reason] = mecenatRuleViolations(
      { date: "2026-09-26", start: "08:00", end: "12:00" },
      context({}, [{ date: "2026-09-25", start: "20:00", end: "23:30" }]),
    );
    expect(reason).toContain("Repos insuffisant");
  });

  it("ne travaille que l'autre moitié d'une demi-journée posée", () => {
    expect(mecenatRuleViolations(
      { date: "2026-09-23", start: "18:00", end: "23:00" },
      context({ "2026-09-23": { status: "partial", halfMoment: "morning" } }),
    )).toEqual([]);
  });

  it("refuse un lundi qui ferait plus de 6 jours de travail d'affilée", () => {
    const [reason] = mecenatRuleViolations(
      { date: "2026-09-21", start: "10:00", end: "14:00" },
      context({
        "2026-09-17": "work", "2026-09-18": "work", "2026-09-19": "work", "2026-09-20": "work",
        "2026-09-22": "work", "2026-09-23": "work",
      }),
    );
    expect(reason).toContain("7 jours de suite, du jeudi 17 septembre au mercredi 23 septembre");
    expect(reason).toContain("congé ou une récupération validé");
  });

  it("accepte un lundi quand un congé coupe la série", () => {
    expect(mecenatRuleViolations(
      { date: "2026-09-21", start: "10:00", end: "14:00" },
      context({
        "2026-09-17": "work", "2026-09-18": "work", "2026-09-19": "absence", "2026-09-20": "work",
        "2026-09-22": "work", "2026-09-23": "work",
      }),
    )).toEqual([]);
  });

  it("n'applique la règle des 6 jours qu'aux lundis", () => {
    expect(mecenatRuleViolations(
      { date: "2026-09-22", start: "10:00", end: "14:00" },
      context({
        "2026-09-16": "work", "2026-09-17": "work", "2026-09-18": "work", "2026-09-19": "work",
        "2026-09-20": "work", "2026-09-21": "work", "2026-09-23": "work",
      }),
    )).toEqual([]);
  });
});
