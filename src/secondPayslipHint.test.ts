import { describe, expect, it } from "vitest";
import {
  CONTRACTUEL_NET_RATIO_FIXED,
  CONTRACTUEL_NET_RATIO_VARIABLE,
  DEFAULT_NET_RATIO_FIXED,
  DEFAULT_NET_RATIO_VARIABLE,
  usesAverageNetRatios,
} from "./payslip";

describe("invitation à vérifier un second bulletin", () => {
  it("reconnaît les taux moyens, fonctionnaire comme contractuel", () => {
    expect(usesAverageNetRatios(DEFAULT_NET_RATIO_FIXED, DEFAULT_NET_RATIO_VARIABLE)).toBe(true);
    expect(usesAverageNetRatios(CONTRACTUEL_NET_RATIO_FIXED, CONTRACTUEL_NET_RATIO_VARIABLE)).toBe(true);
  });

  it("se tait une fois les taux calculés sur les bulletins de la personne", () => {
    expect(usesAverageNetRatios(78.4, 86.2)).toBe(false);
  });
});
