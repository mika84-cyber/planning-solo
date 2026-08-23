import { describe, expect, it } from "vitest";
import {
  latestStrikePayValues,
  strikeIntermediateDay,
  strikePayEstimate,
} from "./strike";
import { rangeKeys } from "./appModel";
import { addDays, dateKey, getDayInfo, holidayName, localDate } from "./planningLogic";

describe("retenue pour grève", () => {
  const workDates = Array.from({ length: 31 }, (_, index) =>
    localDate(2026, 7, index + 1),
  )
    .filter((date) => getDayInfo(date, 1).kind === "work")
    .map(dateKey);
  const periods = [
    {
      id: "strike-1",
      from: workDates[0],
      to: workDates[0],
      leaveType: "strike" as const,
      group: 1,
      updatedAt: "",
    },
  ];
  const payProfiles = {
    "2026-08": { baseSalary: 1801.73, residenceAllowance: 54.05 },
  };

  function strikePeriod(id: string, date: string, group = 1) {
    return { id, from: date, to: date, leaveType: "strike" as const, group, updatedAt: "" };
  }

  it("applique le trentième indivisible", () => {
    const estimate = strikePayEstimate(
      periods,
      1,
      payProfiles,
      2026,
      7,
    );
    expect(estimate.days).toEqual([workDates[0]]);
    expect(estimate.dailyDeduction).toBe(61.86);
    expect(estimate.totalDeduction).toBe(61.86);
    expect(estimate.potentialAdditionalDays).toEqual([]);
    expect(estimate.exactMonthValues).toBe(true);
  });

  it("multiplie la retenue arrondie pour plusieurs jours", () => {
    const estimate = strikePayEstimate(
      [
        periods[0],
        { ...periods[0], id: "strike-2", from: workDates[1], to: workDates[1] },
      ],
      1,
      { "2026": { baseSalary: 1801.73, residenceAllowance: 54.05 } },
      2026,
      7,
    );
    expect(estimate.days).toHaveLength(2);
    expect(estimate.totalDeduction).toBe(123.72);
  });

  it("compte deux grèves sur deux jours calendaires consécutifs sans ajouter de journée", () => {
    const dates = Array.from({ length: 365 }, (_, index) => localDate(2026, 0, index + 1));
    const first = dates.find((date) =>
      getDayInfo(date, 1).kind === "work" && getDayInfo(addDays(date, 1), 1).kind === "work",
    )!;
    const firstKey = dateKey(first);
    const secondKey = dateKey(addDays(first, 1));
    const estimate = strikePayEstimate(
      [strikePeriod("one", firstKey), strikePeriod("two", secondKey)],
      1,
      { [firstKey.slice(0, 7)]: payProfiles["2026-08"] },
      first.getFullYear(),
      first.getMonth(),
    );
    expect(estimate.days).toEqual([firstKey, secondKey]);
    expect(estimate.potentialAdditionalDays).toEqual([]);
    expect(estimate.totalDeduction).toBe(123.72);
  });

  it("exclut les CA enregistrés entre deux grèves et conserve leur nature", () => {
    const first = workDates[0];
    const second = workDates.find((date) => rangeKeys(first, date).length >= 6)!;
    const annual = {
      id: "annual",
      from: dateKey(addDays(new Date(`${first}T12:00:00`), 1)),
      to: dateKey(addDays(new Date(`${second}T12:00:00`), -1)),
      leaveType: "annual" as const,
      group: 1,
      updatedAt: "",
    };
    const source = [strikePeriod("one", first), annual, strikePeriod("two", second)];
    const target = new Date(`${first}T12:00:00`);
    const estimate = strikePayEstimate(
      source,
      1,
      { [first.slice(0, 7)]: payProfiles["2026-08"] },
      target.getFullYear(),
      target.getMonth(),
    );
    expect(estimate.days).toEqual([first, second]);
    expect(estimate.totalDeduction).toBe(123.72);
    expect(estimate.potentialAdditionalDays).toEqual([]);
    expect(estimate.continuityIntervals[0].status).toBe("protected-annual");
    expect(source[1].leaveType).toBe("annual");
  });

  it("inclut automatiquement les repos noirs du cycle entre deux grèves", () => {
    const allDates = Array.from({ length: 730 }, (_, index) => localDate(2025, 0, index + 1));
    const match = allDates.flatMap((date) =>
      Array.from({ length: 6 }, (_, index) => index + 2).map((gap) => ({ date, gap })),
    ).find(({ date, gap }) =>
      getDayInfo(date, 1).kind === "work" &&
      getDayInfo(addDays(date, gap), 1).kind === "work" &&
      Array.from({ length: gap - 1 }, (_, index) => addDays(date, index + 1))
        .every((day) => getDayInfo(day, 1).kind === "off") &&
      date.getMonth() === addDays(date, gap).getMonth(),
    )!;
    const first = match.date;
    const firstKey = dateKey(first);
    const lastKey = dateKey(addDays(first, match.gap));
    const estimate = strikePayEstimate(
      [strikePeriod("one", firstKey), strikePeriod("two", lastKey)],
      1,
      { [firstKey.slice(0, 7)]: payProfiles["2026-08"] },
      first.getFullYear(),
      first.getMonth(),
    );
    expect(estimate.days).toEqual([firstKey, lastKey]);
    expect(estimate.automaticAdditionalDays).toHaveLength(match.gap - 1);
    expect(estimate.potentialAdditionalDays).toEqual([]);
    expect(estimate.totalDeduction).toBe(
      Math.round(61.86 * (match.gap + 1) * 100) / 100,
    );
    expect(estimate.maximumDeductionIfContinuous).toBe(
      Math.round(61.86 * (match.gap + 1) * 100) / 100,
    );
    expect(estimate.continuityIntervals[0].status).toBe("confirmed-cycle-rest");
  });

  it("distingue week-end, jour férié, RTT et récupération", () => {
    const weekendRest = Array.from({ length: 365 }, (_, index) => localDate(2026, 0, index + 1))
      .find((date) =>
        (date.getDay() === 0 || date.getDay() === 6) &&
        getDayInfo(date, 1).kind === "off",
      )!;
    expect(strikeIntermediateDay(dateKey(weekendRest), [], 1).kind).toBe("weekend-rest");

    const holiday = Array.from({ length: 365 }, (_, index) => localDate(2026, 0, index + 1))
      .find((date) => Boolean(holidayName(date)))!;
    expect(strikeIntermediateDay(dateKey(holiday), [], 1).kind).toBe("holiday");

    const key = workDates[2];
    expect(
      strikeIntermediateDay(
        key,
        [{ id: "rtt", from: key, to: key, leaveType: "rtt", group: 1, updatedAt: "" }],
        1,
      ).kind,
    ).toBe("rtt");
    expect(
      strikeIntermediateDay(key, [], 1, {
        recoveryUses: [{ id: "rec", date: key, minutes: 480, updatedAt: "" }],
      }).kind,
    ).toBe("recovery");
  });

  it("recalcule la retenue après suppression d’une grève", () => {
    const two = [periods[0], strikePeriod("strike-2", workDates[1])];
    expect(strikePayEstimate(two, 1, payProfiles, 2026, 7).totalDeduction).toBe(123.72);
    expect(strikePayEstimate(two.slice(0, 1), 1, payProfiles, 2026, 7).totalDeduction).toBe(61.86);
  });

  it("reprend séparément les dernières valeurs antérieures connues", () => {
    expect(
      latestStrikePayValues(
        {
          "2026-03": { baseSalary: 1800, residenceAllowance: 54 },
          "2026-06": { baseSalary: 1850 },
          "2026-09": { residenceAllowance: 60 },
        },
        2026,
        7,
      ),
    ).toEqual({
      baseSalary: 1850,
      residenceAllowance: 54,
      baseSourcePeriod: "2026-06",
      residenceSourcePeriod: "2026-03",
      sourcePeriod: "2026-06",
      exactMonthValues: false,
    });
  });

  it("ne chiffre rien lorsqu’une valeur indispensable manque", () => {
    const estimate = strikePayEstimate(
      periods,
      1,
      { "2026-08": { baseSalary: 1801.73 } },
      2026,
      7,
    );
    expect(estimate.dailyDeduction).toBeNull();
    expect(estimate.totalDeduction).toBeNull();
  });
});
