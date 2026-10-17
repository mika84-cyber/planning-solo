import { describe, expect, it } from "vitest";
import { findColleagueAccount, planningFirstName, planningFirstNames } from "./colleagueNames";

describe("nom affiché dans les plannings partagés", () => {
  it("garde le prénom d'un nom complet et le surnom tel quel", () => {
    expect(planningFirstName("Adriana Lecroulant")).toBe("Adriana");
    expect(planningFirstName("  Adélaïde   Ragu ")).toBe("Adélaïde");
    expect(planningFirstName("Nikky")).toBe("Nikky");
    expect(planningFirstName("Jean-Pierre Martin")).toBe("Jean-Pierre");
  });

  it("ajoute l'initiale du nom quand deux collègues partagent le prénom", () => {
    expect(planningFirstNames([
      { id: "a", name: "Marie Dupont" },
      { id: "b", name: "marie Lefèvre" },
      { id: "c", name: "Nikky" },
    ])).toEqual({ a: "Marie D.", b: "marie L.", c: "Nikky" });
  });
});

describe("findColleagueAccount", () => {
  const directory = [
    { userId: "u1", displayName: "Camille Durand" },
    { userId: "u2", displayName: "Marc" },
    { userId: "u3", displayName: "Julie R." },
    { userId: "u4", displayName: "Julie Roux" },
  ];
  it("reconnaît le nom complet, le prénom seul ou le prénom et l’initiale", () => {
    expect(findColleagueAccount("camille durand", directory)?.userId).toBe("u1");
    expect(findColleagueAccount("Marc Blanc", directory)?.userId).toBe("u2");
    expect(findColleagueAccount("Sarah Lambert", directory)).toBeNull();
  });
  it("ne tranche pas entre deux comptes possibles", () => {
    expect(findColleagueAccount("Julie Roux", directory)).toBeNull();
    expect(findColleagueAccount("", directory)).toBeNull();
  });
});
