import { describe, expect, it } from "vitest";
import { isTrustedMutation } from "./requestSecurity.mts";

describe("protection des écritures HTTP", () => {
  it("autorise la même origine", () => {
    expect(isTrustedMutation(new Request("https://planning.example/api/calendar", {
      method: "POST",
      headers: { origin: "https://planning.example" },
    }))).toBe(true);
  });

  it("refuse une origine extérieure", () => {
    expect(isTrustedMutation(new Request("https://planning.example/api/calendar", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }))).toBe(false);
  });

  it("laisse passer une lecture et un appel interne sans Origin", () => {
    expect(isTrustedMutation(new Request("https://planning.example/api/calendar"))).toBe(true);
    expect(isTrustedMutation(new Request("https://planning.example/api/calendar", { method: "POST" }))).toBe(true);
  });
});
