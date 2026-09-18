import { describe, expect, it } from "vitest";
import {
  attachCarencesToPayslips,
  deductionSlices,
  nextPayMonth,
  payMonthKey,
  previousPayMonth,
  rulePayMonth,
  sanitizeDeductionPayMonths,
  withDeductionPayMonth,
} from "./deductionPayMonth";

describe("mois de paie d’une retenue", () => {
  it("retient le mois même jusqu’au 10, le mois suivant au-delà", () => {
    expect(rulePayMonth("2026-09-01")).toBe("2026-09");
    expect(rulePayMonth("2026-09-10")).toBe("2026-09");
    expect(rulePayMonth("2026-09-11")).toBe("2026-10");
    expect(rulePayMonth("2026-12-20")).toBe("2027-01");
  });

  it("passe d’une année à l’autre dans les deux sens", () => {
    expect(nextPayMonth("2026-12")).toBe("2027-01");
    expect(previousPayMonth("2027-01")).toBe("2026-12");
    expect(payMonthKey(2026, 8)).toBe("2026-09");
  });

  it("envoie tout un arrêt à cheval sur le 10 sur la paie suivante", () => {
    const [slice] = deductionSlices("sick", [
      "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11",
      "2026-09-12", "2026-09-13", "2026-09-14",
    ]);
    expect(slice).toMatchObject({
      key: "sick:2026-09-08",
      from: "2026-09-08",
      to: "2026-09-14",
      ruleMonth: "2026-10",
      payMonth: "2026-10",
      overridden: false,
    });
    expect(slice.dates).toHaveLength(7);
  });

  it("découpe un long arrêt en une tranche par mois", () => {
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 8, 25 + index));
      return date.toISOString().slice(0, 10);
    });
    const slices = deductionSlices("sick", dates);
    expect(slices.map(({ from, to, payMonth }) => ({ from, to, payMonth }))).toEqual([
      { from: "2026-09-25", to: "2026-09-30", payMonth: "2026-10" },
      { from: "2026-10-01", to: "2026-10-24", payMonth: "2026-11" },
    ]);
  });

  it("sépare deux grèves qui ne se suivent pas", () => {
    const slices = deductionSlices("strike", ["2026-09-03", "2026-09-17"]);
    expect(slices.map((slice) => slice.payMonth)).toEqual(["2026-09", "2026-10"]);
  });

  it("applique la correction enregistrée sous la clé de la tranche", () => {
    const [slice] = deductionSlices("sick", ["2024-03-20"], { "sick:2024-03-20": "2024-03" });
    expect(slice).toMatchObject({ ruleMonth: "2024-04", payMonth: "2024-03", overridden: true });
  });

  it("n’applique pas la correction d’un autre type d’absence", () => {
    const [slice] = deductionSlices("strike", ["2024-03-20"], { "sick:2024-03-20": "2024-03" });
    expect(slice.payMonth).toBe("2024-04");
  });

  it("oublie une correction qui revient à la règle", () => {
    const slice = { key: "sick:2026-09-15", ruleMonth: "2026-10" };
    const moved = withDeductionPayMonth({}, slice, "2026-09");
    expect(moved).toEqual({ "sick:2026-09-15": "2026-09" });
    expect(withDeductionPayMonth(moved, slice, "2026-10")).toEqual({});
    expect(withDeductionPayMonth(moved, slice, null)).toEqual({});
  });

  it("rattache au mois du bulletin l’arrêt que nomme sa ligne de carence", () => {
    // Le bulletin de mars 2024 : carence du 20 mars, retenue le mois même.
    const { payMonths, attached } = attachCarencesToPayslips(
      ["2024-03-20", "2024-03-21"],
      [{ year: 2024, month: 2, carenceDates: ["2024-03-20"] }],
      {},
    );
    expect(payMonths).toEqual({ "sick:2024-03-20": "2024-03" });
    expect(attached).toHaveLength(1);
    expect(attached[0].slice.from).toBe("2024-03-20");
  });

  it("ne touche à rien quand le bulletin confirme la règle du 10", () => {
    const existing = { "strike:2026-09-17": "2026-09" };
    const result = attachCarencesToPayslips(
      ["2025-09-16"],
      [{ year: 2025, month: 9, carenceDates: ["2025-09-16"] }],
      existing,
    );
    expect(result.payMonths).toBe(existing);
    expect(result.attached).toEqual([]);
  });

  it("ignore une carence sans arrêt enregistré et un bulletin sans mois", () => {
    const result = attachCarencesToPayslips(
      ["2026-03-02"],
      [
        { year: 2026, month: 2, carenceDates: ["2026-03-18"] },
        { carenceDates: ["2026-03-02"] },
      ],
      undefined,
    );
    expect(result.payMonths).toBeUndefined();
    expect(result.attached).toEqual([]);
  });

  it("rattache chaque arrêt à son propre bulletin lors d’un import de plusieurs mois", () => {
    const { payMonths } = attachCarencesToPayslips(
      ["2024-03-20", "2024-05-14", "2024-05-15"],
      [
        { year: 2024, month: 2, carenceDates: ["2024-03-20"] },
        { year: 2024, month: 4, carenceDates: ["2024-05-14"] },
      ],
      {},
    );
    expect(payMonths).toEqual({
      "sick:2024-03-20": "2024-03",
      "sick:2024-05-14": "2024-05",
    });
  });

  it("écarte les clés et les mois invalides d’une table reçue", () => {
    expect(sanitizeDeductionPayMonths({
      "sick:2026-09-15": "2026-09",
      "strike:2026-09-17": "2026-13",
      "annual:2026-09-18": "2026-09",
      "sick:hier": "2026-09",
    })).toEqual({ "sick:2026-09-15": "2026-09" });
    expect(sanitizeDeductionPayMonths(["sick:2026-09-15"])).toEqual({});
    expect(sanitizeDeductionPayMonths(null)).toEqual({});
  });
});
