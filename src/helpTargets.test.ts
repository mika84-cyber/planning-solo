import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHelpTarget, pendingHelpTarget, requestHelpTarget } from "./helpTargets";

describe("demandes de la fenêtre d'aide", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearHelpTarget("cet");
    clearHelpTarget("radio-codes");
  });

  it("garde la demande jusqu'à ce qu'un écran la serve", () => {
    requestHelpTarget("radio-codes");
    expect(pendingHelpTarget()).toBe("radio-codes");
    clearHelpTarget("cet");
    expect(pendingHelpTarget()).toBe("radio-codes");
    clearHelpTarget("radio-codes");
    expect(pendingHelpTarget()).toBeNull();
  });

  it("oublie une demande que personne n'a servie", () => {
    vi.useFakeTimers();
    requestHelpTarget("cet");
    vi.advanceTimersByTime(9_000);
    expect(pendingHelpTarget()).toBeNull();
  });
});
