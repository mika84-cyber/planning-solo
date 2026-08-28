import { describe, expect, it } from "vitest";
import { workedDayCount, workedDayCountBetween } from "./appModel";
import { dateKey, getDayInfo, localDate } from "./planningLogic";
import {
  allocateRecoveryUses,
  calculatePaidOvertime,
  dailyMinutesForQuota,
  holidayRecoveryCreditMinutes,
  holidayRecoveryEntries,
  monthlyRecoveryBalance,
  nextPayPeriod,
  overtimeFromDuration,
  recoveryRequestMinutes,
  splitOvertimeRange,
  splitOvertimeRangeByCalendar,
  type OvertimeEntry,
} from "./overtime";

const entry = (
  id: string,
  minutes: number,
  disposition: "paid" | "recovery" = "paid",
  nightMinutes = 0,
): OvertimeEntry => ({
  id,
  date: "2026-09-10",
  minutes,
  dayMinutes: minutes - nightMinutes,
  nightMinutes,
  disposition,
  inputMode: "duration",
  updatedAt: "2026-09-10T12:00:00.000Z",
});

describe("quotité de travail", () => {
  it("utilise 8 h, 6 h et 4 h sans changer le cycle", () => {
    expect(dailyMinutesForQuota("full")).toBe(480);
    expect(dailyMinutesForQuota("three_quarters")).toBe(360);
    expect(dailyMinutesForQuota("half")).toBe(240);
  });
});

describe("saisie des heures supplémentaires", () => {
  it("sépare automatiquement le jour et la nuit à 22 h", () => {
    expect(splitOvertimeRange("21:30", "23:00")).toEqual({
      minutes: 90,
      dayMinutes: 30,
      nightMinutes: 60,
    });
  });

  it("accepte et découpe une plage traversant minuit", () => {
    expect(splitOvertimeRange("23:00", "02:00")).toEqual({
      minutes: 180,
      dayMinutes: 0,
      nightMinutes: 180,
    });
  });

  it("reconnaît également la nuit avant 7 h", () => {
    expect(splitOvertimeRange("06:00", "08:00")).toEqual({
      minutes: 120,
      dayMinutes: 60,
      nightMinutes: 60,
    });
  });

  it("reconnaît un dimanche après minuit sans confondre les heures de nuit", () => {
    expect(
      splitOvertimeRangeByCalendar(
        "2026-09-12",
        "21:00",
        "08:00",
        (date) => date === "2026-09-13",
      ),
    ).toEqual({
      minutes: 660,
      dayMinutes: 60,
      sundayHolidayMinutes: 60,
      nightMinutes: 540,
    });
  });

  it("refuse seulement une durée nulle ou des horaires invalides", () => {
    expect(splitOvertimeRange("23:00", "23:00")).toBeNull();
    expect(splitOvertimeRange("25:00", "02:00")).toBeNull();
  });

  it("accepte une durée libre de jour ou de nuit", () => {
    expect(overtimeFromDuration(2, 30, "night")).toEqual({
      minutes: 150,
      dayMinutes: 0,
      nightMinutes: 150,
    });
  });

  it("rattache toujours le paiement au mois suivant", () => {
    expect(nextPayPeriod("2026-09-10")).toEqual({ year: 2026, month: 9 });
    expect(nextPayPeriod("2026-12-10")).toEqual({ year: 2027, month: 0 });
  });
});

describe("calcul IHTS", () => {
  it("ignore les heures récupérées dans le seuil des quatorze heures", () => {
    const result = calculatePaidOvertime(
      [entry("r", 10 * 60, "recovery"), entry("p", 10 * 60)],
      2026,
      8,
      "full",
      1855.88,
      55.68,
    );
    expect(result.lines[0].lowRateMinutes).toBe(600);
    expect(result.lines[0].highRateMinutes).toBe(0);
  });

  it("passe à 1,27 après quatorze heures payées", () => {
    const result = calculatePaidOvertime(
      [entry("r", 10 * 60, "recovery"), entry("p", 16 * 60)],
      2026,
      8,
      "full",
      1855.88,
      55.68,
    );
    expect(result.lines[0].lowRateMinutes).toBe(14 * 60);
    expect(result.lines[0].highRateMinutes).toBe(2 * 60);
    expect(result.hourlyBase).toBeCloseTo(12.60369, 4);
  });

  it("double uniquement les minutes effectuées après 22 h", () => {
    const day = calculatePaidOvertime(
      [entry("day", 60)], 2026, 8, "full", 1855.88, 55.68,
    );
    const night = calculatePaidOvertime(
      [entry("night", 60, "paid", 60)], 2026, 8, "full", 1855.88, 55.68,
    );
    expect(night.amount).toBeCloseTo(day.amount * 2, 8);
  });

  it("majore de deux tiers les heures effectuées un dimanche ou jour férié", () => {
    const sundayEntry = {
      ...entry("sunday", 150),
      date: "2026-05-10",
      start: "10:00",
      end: "12:30",
      inputMode: "range" as const,
    };
    const result = calculatePaidOvertime(
      [sundayEntry],
      2026,
      4,
      "full",
      1895.27,
      56.86,
    );
    expect(result.lines[0].sundayHolidayMinutes).toBe(150);
    expect(result.amount).toBeCloseTo(67.0374, 4);
  });

  it("applique au temps partiel le taux de base sans majoration", () => {
    const result = calculatePaidOvertime(
      [entry("night", 60, "paid", 60)],
      2026,
      8,
      "half",
      927.94,
      27.84,
    );
    expect(result.amount).toBeCloseTo(result.hourlyBase, 8);
  });
});

describe("solde de récupération", () => {
  it.each([
    ["full", 480, 240],
    ["three_quarters", 360, 180],
    ["half", 240, 120],
  ] as const)("convertit journée et demi-journée selon la quotité %s", (quota, day, half) => {
    expect(recoveryRequestMinutes("recovery_day", quota)).toBe(day);
    expect(recoveryRequestMinutes("recovery_holiday", quota)).toBe(day);
    expect(recoveryRequestMinutes("recovery_half", quota)).toBe(half);
  });

  it("conserve la durée personnalisée du formulaire complet", () => {
    expect(recoveryRequestMinutes("recovery_hours", "full", "09:15", "11:45")).toBe(150);
    expect(recoveryRequestMinutes("recovery_hours", "half", "22:30", "00:30")).toBe(120);
  });

  it("décompte la durée de formation choisie entre 3 h et 6 h", () => {
    expect(recoveryRequestMinutes("recovery_training", "full", "09:00", "12:00")).toBe(180);
    expect(recoveryRequestMinutes("recovery_training", "half", "09:00", "15:00")).toBe(360);
    expect(recoveryRequestMinutes("recovery_training", "full", "09:00", "13:00")).toBe(0);
  });

  it.each([
    ["full", 480],
    ["three_quarters", 360],
    ["half", 240],
  ] as const)("crédite prime + récupération selon la quotité %s", (quota, expected) => {
    expect(holidayRecoveryCreditMinutes(["2026-09-10"], quota)).toBe(expected);
    expect(holidayRecoveryEntries(["2026-09-10"], quota)[0].minutes).toBe(expected);
  });

  it("ne crédite jamais deux fois le même férié resynchronisé", () => {
    const dates = ["2026-09-10", "2026-09-10", "2026-09-10"];
    expect(holidayRecoveryCreditMinutes(dates, "full")).toBe(480);
    expect(holidayRecoveryEntries(dates, "full")).toHaveLength(1);
  });

  it("crédite et débite les minutes sans expiration", () => {
    expect(
      monthlyRecoveryBalance(
        [entry("earned", 120, "recovery"), entry("paid", 60)],
        [{ id: "used", date: "2026-10-01", minutes: 45, updatedAt: "x" }],
      ),
    ).toEqual({ earned: 120, used: 45, remaining: 75 });
  });

  it("accepte un crédit manuel pluriannuel de solidarité dans le même solde", () => {
    expect(
      monthlyRecoveryBalance(
        [entry("solidarity-manual", 72 * 60, "recovery")],
        [{ id: "used", date: "2026-10-01", minutes: 90, updatedAt: "x" }],
      ),
    ).toEqual({ earned: 4320, used: 90, remaining: 4230 });
  });

  it("décompte une récupération partielle selon la durée quotidienne", () => {
    const workDate = Array.from({ length: 31 }, (_, index) =>
      new Date(2026, 0, index + 1),
    ).find((date) => getDayInfo(date, 2).kind === "work")!;
    const baseline = workedDayCount(2026, 0, 0, 2, [], {});
    const withHalfDay = workedDayCount(
      2026,
      0,
      0,
      2,
      [],
      {},
      [{ date: dateKey(workDate), minutes: 240 }],
      480,
    );
    expect(withHalfDay.onLeave).toBeCloseTo(baseline.onLeave + 0.5);
    expect(withHalfDay.worked).toBeCloseTo(baseline.worked - 0.5);
  });

  it.each(["other", "cet", "strike"] as const)(
    "retire %s du décompte des jours travaillés",
    (leaveType) => {
    const workDate = Array.from({ length: 31 }, (_, index) =>
      new Date(2026, 0, index + 1),
    ).find((date) => getDayInfo(date, 2).kind === "work")!;
    const baseline = workedDayCount(2026, 0, 0, 2, [], {});
    const withAbsence = workedDayCount(
      2026,
      0,
      0,
      2,
      [
        {
          id: `period-${leaveType}`,
          from: dateKey(workDate),
          to: dateKey(workDate),
          leaveType,
          group: 2,
          updatedAt: "x",
        },
      ],
      {},
    );
    expect(withAbsence.onLeave).toBe(baseline.onLeave + 1);
    expect(withAbsence.worked).toBe(baseline.worked - 1);
    },
  );

  it("retire une fermeture exceptionnelle d'une journée prévue au cycle", () => {
    const workDate = Array.from({ length: 31 }, (_, index) =>
      new Date(2026, 0, index + 1),
    ).find((date) => getDayInfo(date, 2).kind === "work")!;
    const workKey = dateKey(workDate);
    const baseline = workedDayCount(2026, 0, 0, 2, [], {});
    const withClosure = workedDayCount(
      2026,
      0,
      0,
      2,
      [],
      {},
      [],
      480,
      (key) => key === workKey,
    );

    expect(withClosure.scheduled).toBe(baseline.scheduled);
    expect(withClosure.onLeave).toBe(baseline.onLeave);
    expect(withClosure.exceptionallyClosed).toBe(1);
    expect(withClosure.worked).toBe(baseline.worked - 1);
  });

  it("compte aussi une fermeture tombant sur une formation du cycle", () => {
    const trainingDate = Array.from({ length: 31 }, (_, index) =>
      new Date(2026, 8, index + 1),
    ).find((date) => getDayInfo(date, 2).kind === "training")!;
    const trainingKey = dateKey(trainingDate);
    const baseline = workedDayCount(2026, 8, 8, 2, [], {});
    const withClosure = workedDayCount(
      2026,
      8,
      8,
      2,
      [],
      {},
      [],
      480,
      (key) => key === trainingKey,
    );

    expect(withClosure.scheduled).toBe(baseline.scheduled);
    expect(withClosure.exceptionallyClosed).toBe(1);
    expect(withClosure.worked).toBe(baseline.worked - 1);
  });

  it("retire aussi la fermeture du travail restant entre deux dates", () => {
    const workDate = Array.from({ length: 31 }, (_, index) =>
      new Date(2026, 0, index + 1),
    ).find((date) => getDayInfo(date, 2).kind === "work")!;
    const workKey = dateKey(workDate);
    const result = workedDayCountBetween(
      workDate,
      workDate,
      2,
      [],
      {},
      [],
      480,
      (key) => key === workKey,
    );

    expect(result).toEqual({
      scheduled: 1,
      onLeave: 0,
      exceptionallyClosed: 1,
      worked: 0,
    });
  });

  it("retire toutes les absences du travail restant jusqu’à la fin de l’année", () => {
    const workDates = Array.from({ length: 31 }, (_, index) => localDate(2026, 7, index + 1))
      .filter((date) => getDayInfo(date, 2).kind === "work")
      .slice(0, 5);
    const baseline = workedDayCountBetween(workDates[0], localDate(2026, 11, 31), 2, [], {});
    const leaveTypes = ["annual", "other", "sick", "strike", "cet"] as const;
    const withAbsences = workedDayCountBetween(
      workDates[0],
      localDate(2026, 11, 31),
      2,
      workDates.map((date, index) => ({
        id: `remaining-${leaveTypes[index]}`,
        from: dateKey(date),
        to: dateKey(date),
        leaveType: leaveTypes[index],
        group: 2,
        updatedAt: "x",
      })),
      {},
    );
    expect(withAbsences.worked).toBe(baseline.worked - leaveTypes.length);
  });

  it("affecte les utilisations aux gains les plus anciens", () => {
    const older = entry("older-gain", 120, "recovery");
    const newer = { ...entry("newer-gain", 120, "recovery"), date: "2026-09-11" };
    expect(
      allocateRecoveryUses([newer, older], [
        { id: "used-hours", date: "2026-10-01", minutes: 150, updatedAt: "x" },
      ]),
    ).toEqual([
      { entryId: "older-gain", usedMinutes: 120, remainingMinutes: 0 },
      { entryId: "newer-gain", usedMinutes: 30, remainingMinutes: 90 },
    ]);
  });
});
