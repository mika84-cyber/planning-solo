import { describe, expect, it } from "vitest";
import { delayUntilNextDay, followDay } from "./useDayChange";

describe("l'application restée ouverte suit le jour", () => {
  it("garde le même jour tel quel et passe au nouveau après minuit", () => {
    const evening = new Date(2026, 10, 14, 23, 50);
    expect(followDay(evening, new Date(2026, 10, 14, 23, 59))).toBe(evening);
    const night = new Date(2026, 10, 15, 0, 4);
    expect(followDay(evening, night)).toBe(night);
  });

  it("relit la date juste après minuit", () => {
    expect(delayUntilNextDay(new Date(2026, 10, 14, 23, 59, 0))).toBe(65_000);
    expect(delayUntilNextDay(new Date(2026, 10, 15, 0, 0, 5))).toBe(24 * 3_600_000);
  });
});
