import { describe, expect, it } from "vitest";
import { planningFirstName, planningFirstNames } from "./colleagueNames";

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
