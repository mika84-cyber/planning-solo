import { describe, expect, it } from "vitest";
import { workedDayCount, workedDayCountBetween } from "./appModel";
import { dateKey, getDayInfo, localDate } from "./planningLogic";
import {
  allocateRecoveryUses,
  calculatePaidOvertime,
  dailyMinutesForQuota,
  defaultRecoveryMinutes,
  holidayRecoveryCreditMinutes,
  holidayRecoveryEntries,
  storedHolidayRecoveryCreditMinutes,
  monthlyRecoveryBalance,
  nextPayPeriod,
  overtimeRecoveryCreditMinutes,
  overtimeRangeRecoveryPreview,
  overtimeFromDuration,
  recoveryRequestMinutes,
  splitOvertimeRange,
  splitOvertimeRangeByCalendar,
  trainingRecoveryTimes,
  workScheduleHalfTimes,
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

describe("horaires proposés", () => {
  it("découpe l’horaire du profil sur un quart d’heure", () => {
    expect(workScheduleHalfTimes({ start: "09:15", end: "17:30" }, "morning")).toEqual({ start: "09:15", end: "13:30" });
    expect(workScheduleHalfTimes({ start: "09:15", end: "17:30" }, "afternoon")).toEqual({ start: "13:30", end: "17:30" });
  });

  it("applique les horaires propres aux formations", () => {
    expect(trainingRecoveryTimes("full")).toEqual({ start: "10:00", end: "16:00" });
    expect(trainingRecoveryTimes("three_quarters")).toEqual({ start: "10:00", end: "16:00" });
    expect(trainingRecoveryTimes("full", "morning", 180)).toEqual({ start: "10:00", end: "13:00" });
    expect(trainingRecoveryTimes("three_quarters", "afternoon", 180)).toEqual({ start: "13:00", end: "16:00" });
    expect(trainingRecoveryTimes("half", "morning")).toEqual({ start: "10:00", end: "13:00" });
    expect(trainingRecoveryTimes("half", "afternoon")).toEqual({ start: "13:00", end: "16:00" });
  });
});

describe("durée présélectionnée des récupérations", () => {
  it.each([
    ["full", 495], ["three_quarters", 390], ["half", 240],
  ] as const)("utilise %i minutes pour un férié à quotité %s", (quota, expected) => {
    expect(defaultRecoveryMinutes("holiday", quota)).toBe(expected);
  });
});

describe("quotité de travail", () => {
  it("utilise 8 h, 6 h et 3 h 45 sans changer le cycle", () => {
    expect(dailyMinutesForQuota("full")).toBe(480);
    expect(dailyMinutesForQuota("three_quarters")).toBe(360);
    expect(dailyMinutesForQuota("half")).toBe(225);
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
  it("majore les heures supplémentaires récupérées selon la période travaillée", () => {
    const ranged = (date: string, start: string, end: string): OvertimeEntry => {
      const duration = splitOvertimeRange(start, end)!;
      return { id: `${date}-${start}`, date, ...duration, disposition: "recovery", inputMode: "range", start, end, updatedAt: "v1" };
    };
    const specialDay = (date: string) => date === "2026-05-10";
    expect(overtimeRecoveryCreditMinutes(ranged("2026-05-11", "10:00", "11:00"), specialDay)).toBe(75);
    expect(overtimeRecoveryCreditMinutes(ranged("2026-05-11", "22:00", "23:00"), specialDay)).toBe(120);
    expect(overtimeRecoveryCreditMinutes(ranged("2026-05-10", "10:00", "11:00"), specialDay)).toBe(100);
    expect(overtimeRecoveryCreditMinutes(ranged("2026-05-11", "21:30", "22:30"), specialDay)).toBe(98);
    expect(overtimeRecoveryCreditMinutes(entry("manual", 60, "recovery"), specialDay)).toBe(60);
    expect(monthlyRecoveryBalance([
      ranged("2026-05-11", "10:00", "11:00"),
      ranged("2026-05-11", "22:00", "23:00"),
      ranged("2026-05-10", "10:00", "11:00"),
    ], [], specialDay)).toEqual({ earned: 295, used: 0, remaining: 295 });
  });

  it.each([
    ["full", 480, 240],
    ["three_quarters", 360, 180],
    ["half", 225, 225],
  ] as const)("convertit journée et demi-journée selon la quotité %s", (quota, day, half) => {
    expect(recoveryRequestMinutes("recovery_day", quota)).toBe(day);
    expect(recoveryRequestMinutes("recovery_half", quota)).toBe(half);
  });

  it.each([
    ["full", 495],
    ["three_quarters", 390],
    ["half", 240],
  ] as const)("solde exactement un férié acquis puis posé à la quotité %s", (quota, minutes) => {
    const earned = holidayRecoveryEntries([{ date: "2026-09-10", minutes }]);
    const used = [{ id: "holiday-use", date: "2026-10-01", minutes: recoveryRequestMinutes("recovery_holiday", quota), updatedAt: "v1" }];
    expect(monthlyRecoveryBalance(earned, used)).toEqual({ earned: minutes, used: minutes, remaining: 0 });
  });

  it("conserve la durée personnalisée du formulaire complet", () => {
    expect(recoveryRequestMinutes("recovery_hours", "full", "09:15", "11:45")).toBe(150);
    expect(recoveryRequestMinutes("recovery_hours", "half", "22:30", "00:30")).toBe(120);
  });

  it("décompte 6 h en temps plein ou partiel et 3 h à mi-temps pour une formation", () => {
    expect(recoveryRequestMinutes("recovery_training", "full", "10:00", "16:00")).toBe(360);
    expect(recoveryRequestMinutes("recovery_training", "three_quarters", "10:00", "16:00")).toBe(360);
    expect(recoveryRequestMinutes("recovery_training", "half", "10:00", "13:00")).toBe(180);
    expect(recoveryRequestMinutes("recovery_training", "half", "13:00", "16:00")).toBe(180);
    expect(recoveryRequestMinutes("recovery_training", "full", "10:00", "13:00")).toBe(180);
    expect(recoveryRequestMinutes("recovery_training", "three_quarters", "13:00", "16:00")).toBe(180);
  });

  it.each([
    ["full", 495],
    ["three_quarters", 390],
    ["half", 240],
  ] as const)("crédite prime + récupération selon la quotité %s", (quota, expected) => {
    expect(holidayRecoveryCreditMinutes(["2026-09-10"], quota)).toBe(expected);
    expect(holidayRecoveryEntries(["2026-09-10"], quota)[0].minutes).toBe(expected);
  });

  it("ne crédite jamais deux fois le même férié resynchronisé", () => {
    const dates = ["2026-09-10", "2026-09-10", "2026-09-10"];
    expect(holidayRecoveryCreditMinutes(dates, "full")).toBe(495);
    expect(holidayRecoveryEntries(dates, "full")).toHaveLength(1);
  });

  it("ne recalcule pas un ancien crédit dont la quotité historique est inconnue", () => {
    expect(holidayRecoveryEntries([{ date: "2025-12-25" }])).toEqual([]);
    expect(storedHolidayRecoveryCreditMinutes([
      { holiday_recovery_minutes: 390 },
      { holiday_recovery_minutes: 240 },
      {},
    ])).toBe(630);
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

  it("déduit une fermeture tombant sur une formation du travail prévu", () => {
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

  it("applique congé, demi-journée, récupération et échange aux formations", () => {
    const trainingDate = Array.from({ length: 31 }, (_, index) =>
      new Date(2026, 8, index + 1),
    ).find((date) => getDayInfo(date, 2).kind === "training")!;
    const trainingKey = dateKey(trainingDate);
    const baseline = workedDayCountBetween(trainingDate, trainingDate, 2, [], {});
    const fullLeave = workedDayCountBetween(trainingDate, trainingDate, 2, [{ id: "training-leave", from: trainingKey, to: trainingKey, leaveType: "annual", updatedAt: "x" }], {});
    const halfLeave = workedDayCountBetween(trainingDate, trainingDate, 2, [{ id: "training-half", from: trainingKey, to: trainingKey, leaveType: "half", halfMoment: "morning", updatedAt: "x" }], {});
    const recovery = workedDayCountBetween(trainingDate, trainingDate, 2, [], {}, [{ date: trainingKey, minutes: 180 }], 480);
    const fullRecovery = workedDayCountBetween(trainingDate, trainingDate, 2, [], {}, [{ date: trainingKey, minutes: 360 }], 480);
    const halfTimeRecovery = workedDayCountBetween(trainingDate, trainingDate, 2, [], {}, [{ date: trainingKey, minutes: 180 }], 225);
    const exchange = workedDayCountBetween(trainingDate, trainingDate, 2, [], {}, [], 480, () => false, () => "given");

    expect(baseline).toMatchObject({ scheduled: 1, worked: 1 });
    expect(fullLeave).toMatchObject({ onLeave: 1, worked: 0 });
    expect(halfLeave).toMatchObject({ onLeave: 0.5, worked: 0.5 });
    expect(recovery).toMatchObject({ onLeave: 0.5, worked: 0.5 });
    expect(fullRecovery).toMatchObject({ onLeave: 1, worked: 0 });
    expect(halfTimeRecovery).toMatchObject({ onLeave: 1, worked: 0 });
    expect(exchange).toMatchObject({ exchangedGiven: 1, worked: 0 });
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
      exchangedGiven: 0,
      exchangedReturned: 0,
      worked: 0,
    });
  });

  it("retire toutes les absences du travail restant jusqu’à la fin de l’année", () => {
    const workDates = Array.from({ length: 31 }, (_, index) => localDate(2026, 7, index + 1))
      .filter((date) => getDayInfo(date, 2).kind === "work")
      .slice(0, 6);
    const baseline = workedDayCountBetween(workDates[0], localDate(2026, 11, 31), 2, [], {});
    const leaveTypes = ["annual", "other", "sick", "strike", "cet", "work_accident"] as const;
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
      { entryId: "older-gain", earnedMinutes: 120, usedMinutes: 120, remainingMinutes: 0 },
      { entryId: "newer-gain", earnedMinutes: 120, usedMinutes: 30, remainingMinutes: 90 },
    ]);
  });
});

describe("aperçu du crédit pendant la saisie", () => {
  const dimanche = (date: string) => date === "2026-08-23";

  it("donne les heures faites et le crédit majoré", () => {
    expect(overtimeRangeRecoveryPreview("2026-08-21", "14:00", "17:00", dimanche))
      .toEqual({ workedMinutes: 180, creditedMinutes: 225 });
  });

  it("donne le même résultat que le crédit enregistré", () => {
    // Les deux passent par la même fonction : s'ils divergeaient, l'annonce
    // faite à la saisie mentirait sur ce qui sera réellement crédité.
    const entry = {
      id: "e1",
      date: "2026-08-21",
      minutes: 225,
      dayMinutes: 225,
      nightMinutes: 0,
      disposition: "recovery" as const,
      inputMode: "range" as const,
      start: "20:00",
      end: "00:00",
      updatedAt: "2026-08-21",
    };
    const preview = overtimeRangeRecoveryPreview("2026-08-21", "20:00", "00:00", dimanche);
    expect(preview?.creditedMinutes).toBe(
      overtimeRecoveryCreditMinutes(entry, dimanche),
    );
  });

  it("ne renvoie rien tant que la plage est incomplète", () => {
    expect(overtimeRangeRecoveryPreview("2026-08-21", "", "", dimanche)).toBeNull();
    expect(overtimeRangeRecoveryPreview("2026-08-21", "14:00", "14:00", dimanche)).toBeNull();
  });
});

describe("reprise du solde déjà accumulé", () => {
  it("ne remajore pas un ajout manuel", () => {
    // Le solde repris vient des compteurs tenus avant l'application : la
    // majoration y a déjà été faite. La réappliquer gonflerait le solde.
    const repris = entry("solidarity-manual", 20 * 60, "recovery");
    expect(overtimeRecoveryCreditMinutes(repris)).toBe(20 * 60);
  });

  it("laisse aussi intacts les crédits de férié", () => {
    const ferie = holidayRecoveryEntries([{ date: "2026-07-14", minutes: 6 * 60 + 15 }]);
    expect(overtimeRecoveryCreditMinutes(ferie[0])).toBe(6 * 60 + 15);
  });

  it("n’applique les coefficients qu’aux heures déclarées par horaires", () => {
    const parHoraires = {
      ...entry("range", 180, "recovery"),
      inputMode: "range" as const,
      start: "14:00",
      end: "17:00",
    };
    expect(overtimeRecoveryCreditMinutes(parHoraires)).toBe(225);
  });
});

describe("plafond mensuel des heures payées", () => {
  const payee = (minutes: number) =>
    calculatePaidOvertime(
      [entry("long", minutes)],
      2026,
      8,
      "full",
      1855.88,
      55.68,
    );

  it("paie tout tant qu’on reste sous vingt-cinq heures", () => {
    const result = payee(20 * 60);
    expect(result.cappedMinutes).toBe(0);
    expect(result.lines[0].lowRateMinutes).toBe(14 * 60);
    expect(result.lines[0].highRateMinutes).toBe(6 * 60);
  });

  it("ne paie pas au-delà du plafond, et dit combien reste dehors", () => {
    // Trente heures déclarées : cinq ne sont pas indemnisables.
    const result = payee(30 * 60);
    expect(result.cappedMinutes).toBe(5 * 60);
    expect(result.totalMinutes).toBe(30 * 60);
    expect(result.lines[0].lowRateMinutes + result.lines[0].highRateMinutes).toBe(25 * 60);
    // Le montant est celui de vingt-cinq heures, pas de trente.
    expect(result.amount).toBeCloseTo(payee(25 * 60).amount, 8);
  });

  it("applique aussi le plafond à temps partiel", () => {
    const result = calculatePaidOvertime(
      [entry("long", 30 * 60)],
      2026,
      8,
      "half",
      927.94,
      27.84,
    );
    expect(result.cappedMinutes).toBe(5 * 60);
  });
});

describe("majoration du dimanche", () => {
  it("vaut les deux tiers, comme en paie", () => {
    // 1,66 était la même règle arrondie : sur six heures, l'écart atteignait
    // deux minutes et demie.
    const dimanche = (date: string) => date === "2026-05-10";
    const plage = {
      ...entry("dimanche", 390, "recovery"),
      date: "2026-05-10",
      inputMode: "range" as const,
      start: "10:00",
      end: "16:30",
    };
    expect(overtimeRecoveryCreditMinutes(plage, dimanche)).toBe(650);
  });
});
