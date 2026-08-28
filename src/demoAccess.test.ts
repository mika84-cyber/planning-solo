import { describe, expect, it } from "vitest";
import { resolvePublicDemoAccess } from "./demoAccess";

describe("resolvePublicDemoAccess", () => {
  const expiration = "2026-09-15T23:59:59+02:00";

  it("reste inactif dans le build public habituel", () => {
    expect(resolvePublicDemoAccess(undefined)).toEqual({ active: false, expired: false });
  });

  it("autorise la démonstration jusqu'à l'échéance incluse", () => {
    expect(resolvePublicDemoAccess(expiration, Date.parse(expiration))).toEqual({
      active: true,
      expired: false,
    });
  });

  it("bloque la démonstration après l'échéance", () => {
    expect(resolvePublicDemoAccess(expiration, Date.parse("2026-09-16T00:00:00+02:00"))).toEqual({
      active: false,
      expired: true,
    });
  });
});
