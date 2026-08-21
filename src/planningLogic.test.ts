import { describe, expect, it } from "vitest";
import {
  addDays,
  applyManualSundayLeave,
  coWorkingGroupsForDate,
  dateKey,
  fromKey,
  getDayInfo,
  groupConsecutive,
  holidayAllowance,
  holidayName,
  holidayPayslip,
  holidaysForYear,
  isAlwaysOffHoliday,
  leaveTypeLabel,
  localDate,
  multiDatePersonLabel,
  nextAttendanceDay,
  periodLabel,
  sameDate,
  schoolVacationsForZone,
  sickLeaveDeduction,
  sundayAllowance,
  sundayPayslip,
  unpaidSundays,
  TYPE_COLORS,
  YEAR_OPTIONS,
  wasPompidouHolidayWorked,
} from "./planningLogic";

describe("années proposées", () => {
  it("commence en 2026 et va jusqu’en 2050", () => {
    expect(YEAR_OPTIONS).toHaveLength(25);
    expect(YEAR_OPTIONS[0]).toEqual({ value: 2026, label: "2026" });
    expect(YEAR_OPTIONS.at(-1)).toEqual({ value: 2050, label: "2050" });
    expect(YEAR_OPTIONS.map(({ value }) => value)).not.toContain(2024);
    expect(YEAR_OPTIONS.map(({ value }) => value)).not.toContain(2025);
  });
});

describe("reprise des dimanches posés sans date", () => {
  const sundays = [
    "2026-01-04",
    "2026-03-01",
    "2026-07-05",
    "2026-09-06",
    "2026-10-04",
    "2026-11-01",
    "2026-12-06",
    "2026-12-13",
  ].map((key) => ({ key }));

  it("retire séparément les dimanches des quatre périodes de paie", () => {
    expect(
      applyManualSundayLeave(sundays, {
        janJun: 1,
        julSep: 2,
        octNov: 1,
        dec: 1,
      }).map((item) => item.key),
    ).toEqual(["2026-03-01", "2026-11-01", "2026-12-13"]);
  });

  it("ne retire jamais les dimanches d'une autre période", () => {
    expect(
      applyManualSundayLeave(sundays, {
        janJun: 0,
        julSep: 0,
        octNov: 0,
        dec: 8,
      }).map((item) => item.key),
    ).toEqual(sundays.slice(0, 6).map((item) => item.key));
  });
});

describe("vacances scolaires annuelles", () => {
  it.each(["A", "B", "C"] as const)(
    "conserve toutes les périodes 2026 de la zone %s, même déjà passées",
    (zone) => {
      const periods = schoolVacationsForZone(zone).filter(
        ({ from, to }) => from <= "2026-12-31" && to >= "2026-01-01",
      );
      expect(periods).toHaveLength(6);
      expect(periods[0].name).toBe("Vacances de Noël");
      expect(periods.some(({ name }) => name === "Vacances d’été")).toBe(true);
      expect(periods.at(-1)?.from).toBe("2026-12-19");
    },
  );
});

describe("palette du planning", () => {
  it("reprend exactement les couleurs CA, RTT et fractionnement fournies", () => {
    expect(TYPE_COLORS.annual).toBe("#6cbdf0");
    expect(TYPE_COLORS.rtt).toBe("#72b7ad");
    expect(TYPE_COLORS.fraction).toBe("#c9a6ea");
  });
});

describe("cycle (baseKind / getDayInfo)", () => {
  it("matches the anchor index for each group on the anchor date", () => {
    const anchor = localDate(2026, 6, 31);
    expect(getDayInfo(anchor, 1).kind).toBe("work");
    expect(getDayInfo(anchor, 2).kind).toBe("work");
    expect(getDayInfo(anchor, 3).kind).toBe("off");
  });

  it("rolls through the 21-day cycle for group 2", () => {
    const anchor = localDate(2026, 6, 31);
    expect(getDayInfo(addDays(anchor, 3), 2).kind).toBe("off");
    expect(getDayInfo(addDays(anchor, 6), 2).kind).toBe("off");
    expect(getDayInfo(addDays(anchor, 19), 2).kind).toBe("training");
  });

  it("considère le mercredi de formation comme prochain jour travaillé", () => {
    const tuesday = localDate(2026, 7, 18);
    const next = nextAttendanceDay(tuesday, 2);
    expect(next && dateKey(next)).toBe("2026-08-19");
    expect(next?.getDay()).toBe(3);
    expect(next && getDayInfo(next, 2).kind).toBe("training");
  });

  it("ignore une formation couverte par un congé", () => {
    const next = nextAttendanceDay(
      localDate(2026, 7, 18),
      2,
      (key) => key === "2026-08-19",
    );
    expect(next && dateKey(next)).not.toBe("2026-08-19");
  });

  it("n'annonce que le groupe réellement au travail le mercredi", () => {
    const wednesday = localDate(2026, 7, 19);
    expect(getDayInfo(wednesday, 1).kind).toBe("work");
    expect(getDayInfo(wednesday, 2).kind).toBe("training");
    expect(getDayInfo(wednesday, 3).kind).toBe("work");
    expect(coWorkingGroupsForDate(wednesday, 1)).toEqual([3]);
  });

  it("n'annonce aucun groupe quand l'utilisatrice est en formation", () => {
    expect(coWorkingGroupsForDate(localDate(2026, 7, 19), 2)).toEqual([]);
  });
});

describe("holidayName (2026 French public holidays)", () => {
  it("finds fixed-date holidays", () => {
    expect(holidayName(localDate(2026, 0, 1))).toBe("Jour de l’an");
    expect(holidayName(localDate(2026, 4, 1))).toBe("Fête du Travail");
    expect(holidayName(localDate(2026, 4, 8))).toBe("Victoire 1945");
    expect(holidayName(localDate(2026, 6, 14))).toBe("Fête nationale");
    expect(holidayName(localDate(2026, 7, 15))).toBe("Assomption");
    expect(holidayName(localDate(2026, 10, 1))).toBe("Toussaint");
    expect(holidayName(localDate(2026, 10, 11))).toBe("Armistice 1918");
    expect(holidayName(localDate(2026, 11, 25))).toBe("Noël");
  });

  it("finds Easter-derived holidays (Easter 2026 is April 5th)", () => {
    expect(holidayName(localDate(2026, 3, 5))).toBe("Dimanche de Pâques");
    expect(holidayName(localDate(2026, 3, 6))).toBe("Lundi de Pâques");
    expect(holidayName(localDate(2026, 4, 14))).toBe("Ascension");
    expect(holidayName(localDate(2026, 4, 24))).toBe("Dimanche de Pentecôte");
    expect(holidayName(localDate(2026, 4, 25))).toBe("Lundi de Pentecôte");
  });

  it("returns an empty string for non-holidays", () => {
    expect(holidayName(localDate(2026, 7, 20))).toBe("");
  });
});

describe("isAlwaysOffHoliday", () => {
  it("is true only for May 1st, July 14th and December 25th", () => {
    expect(isAlwaysOffHoliday(localDate(2026, 4, 1))).toBe(true);
    expect(isAlwaysOffHoliday(localDate(2026, 6, 14))).toBe(true);
    expect(isAlwaysOffHoliday(localDate(2026, 11, 25))).toBe(true);
    expect(isAlwaysOffHoliday(localDate(2026, 0, 1))).toBe(false);
    expect(isAlwaysOffHoliday(localDate(2026, 7, 15))).toBe(false);
  });
});

describe("getDayInfo + wasPompidouHolidayWorked interaction (group 2, 2026)", () => {
  it("forces a normally-worked cycle day off on Dec 25th and flags it as offered", () => {
    const christmas = localDate(2026, 11, 25);
    const info = getDayInfo(christmas, 2);
    expect(info).toEqual({ kind: "off", holiday: "Noël", selectable: false });
    expect(wasPompidouHolidayWorked(christmas, 2)).toBe(true);
  });

  it("leaves an already-off holiday alone and does not flag it as offered", () => {
    const toussaint = localDate(2026, 10, 1);
    const info = getDayInfo(toussaint, 2);
    expect(info.kind).toBe("off");
    expect(wasPompidouHolidayWorked(toussaint, 2)).toBe(false);
  });

  it("keeps a worked holiday as work when it isn't in the always-off list", () => {
    const assomption = localDate(2026, 7, 15);
    const info = getDayInfo(assomption, 2);
    expect(info).toEqual({
      kind: "work",
      holiday: "Assomption",
      selectable: true,
    });
  });

  it("special-cases May 1st to never count as offered", () => {
    expect(wasPompidouHolidayWorked(localDate(2026, 4, 1), 2)).toBe(false);
  });
});

describe("date helpers", () => {
  it("round-trips dateKey/fromKey", () => {
    const date = localDate(2026, 7, 15);
    expect(dateKey(date)).toBe("2026-08-15");
    expect(sameDate(fromKey("2026-08-15"), date)).toBe(true);
  });

  it("adds days across month boundaries", () => {
    expect(sameDate(addDays(localDate(2026, 7, 31), 1), localDate(2026, 8, 1))).toBe(
      true,
    );
  });
});

describe("groupConsecutive", () => {
  it("groups consecutive date keys and starts a new group on a gap", () => {
    expect(
      groupConsecutive(["2026-08-01", "2026-08-02", "2026-08-04"]),
    ).toEqual([
      { from: "2026-08-01", to: "2026-08-02" },
      { from: "2026-08-04", to: "2026-08-04" },
    ]);
  });
});

describe("labels", () => {
  it("labels people and periods", () => {
    expect(multiDatePersonLabel("leave")).toBe("Congé");
    expect(multiDatePersonLabel("personal")).toBe("Divers");
    expect(leaveTypeLabel("rtt")).toBe("RTT");
    expect(leaveTypeLabel("")).toBe("Type non renseigné");
    expect(periodLabel("2026-08-01", "2026-08-01")).toBe("01/08/2026");
    expect(periodLabel("2026-08-01", "2026-08-03")).toBe(
      "Du 01/08/2026 au 03/08/2026",
    );
  });
});

describe("indemnité de jour férié", () => {
  // Traitement de base relevé sur le bulletin de juin 2026.
  const traitement = 1855.88;

  it("retrouve le montant du bulletin pour deux fériés en prime seule", () => {
    // Le bulletin porte 524,10 € pour les fériés des 8 et 24 mai 2026. L'écart
    // de deux centimes vient du traitement de mai, légèrement différent de
    // celui de juin qu'affiche la ligne « Traitement de Base ».
    const paire = holidayAllowance(traitement, "prime") * 2;
    expect(paire).toBeCloseTo(524.1, 1);
  });

  it("chiffre les deux compensations", () => {
    expect(holidayAllowance(traitement, "prime")).toBeCloseTo(262.06, 2);
    expect(holidayAllowance(traitement, "recovery")).toBeCloseTo(189.06, 2);
  });

  /* Les bulletins d'avril 2024 à janvier 2026 ont payé la variante « avec
     récupération » à 2,514 et non 2,59. C'était une erreur de
     l'administration : elle l'a rattrapée en mars et mai 2026 par neuf lignes
     d'ajustement, dont le montant est exactement la différence entre les deux
     coefficients. Le test le vérifie, pour qu'un futur dépouillement de vieux
     bulletins ne fasse pas rebasculer le coefficient à tort. */
  it("retrouve les rappels de 2026 qui corrigent les fériés sous-payés", () => {
    const rappel = (t: number) =>
      holidayAllowance(t, "recovery") - (2.514 * t * 1.18) / 30;
    expect(rappel(1831.27)).toBeCloseTo(5.47, 2);
    expect(rappel(1841.12)).toBeCloseTo(5.5, 2);
    expect(rappel(1850.96)).toBeCloseTo(5.53, 2);
  });

  it("rend la prime proportionnelle au traitement", () => {
    expect(holidayAllowance(0, "prime")).toBe(0);
    expect(holidayAllowance(traitement * 2, "prime")).toBeCloseTo(
      holidayAllowance(traitement, "prime") * 2,
      6,
    );
  });
});

describe("indemnité dominicale", () => {
  it("retire automatiquement les dimanches absents du bulletin", () => {
    expect(unpaidSundays(6, 4)).toBe(2);
    expect(unpaidSundays(4, 6)).toBe(0);
  });

  it("ne verse que le forfait en deçà du onzième dimanche", () => {
    for (const count of [0, 5, 10]) {
      const montant = sundayAllowance(count);
      expect(montant.perSundayCount).toBe(0);
      expect(montant.total).toBeCloseTo(1075.05, 2);
    }
  });

  it("ajoute les dimanches du onzième au trente-et-unième", () => {
    const montant = sundayAllowance(18);
    expect(montant.perSundayCount).toBe(8);
    expect(montant.total).toBeCloseTo(1075.05 + 8 * 54.93, 2);
  });

  it("plafonne au trente-et-unième dimanche", () => {
    const plafond = sundayAllowance(31);
    expect(plafond.perSundayCount).toBe(21);
    expect(plafond.total).toBeCloseTo(2228.58, 2);
    // Trois dimanches de plus ne rapportent rien, mais restent signalés.
    const au_dela = sundayAllowance(34);
    expect(au_dela.total).toBeCloseTo(plafond.total, 2);
    expect(au_dela.unpaid).toBe(3);
  });
});

describe("sundayPayslip", () => {
  it("range chaque dimanche sur la paie qui le porte", () => {
    expect(sundayPayslip("2026-01-04").label).toBe("paie de juillet");
    expect(sundayPayslip("2026-06-28").label).toBe("paie de juillet");
    expect(sundayPayslip("2026-07-05").label).toBe("paie d’octobre");
    expect(sundayPayslip("2026-09-27").label).toBe("paie d’octobre");
    expect(sundayPayslip("2026-10-04").label).toBe("paie de décembre");
    expect(sundayPayslip("2026-11-29").label).toBe("paie de décembre");
    expect(sundayPayslip("2026-12-06").label).toBe("paie de janvier");
  });
});

describe("holidayPayslip", () => {
  it("porte un férié sur la paie du mois suivant", () => {
    // Les fériés des 8 et 24 mai 2026 figurent sur le bulletin de juin.
    expect(holidayPayslip("2026-05-08").label).toBe("paie de juin");
    expect(holidayPayslip("2026-05-24").label).toBe("paie de juin");
    expect(holidayPayslip("2026-11-11").label).toBe("paie de décembre");
  });

  it("garde le 1er janvier sur la paie de janvier", () => {
    expect(holidayPayslip("2026-01-01").label).toBe("paie de janvier");
  });
});

describe("indemnité dominicale — année 2025 réelle", () => {
  it("retrouve le total de ses quatre bulletins", () => {
    // Relevé sur les paies de juillet, octobre et décembre 2025 puis janvier
    // 2026 : 3 + 9 + 4 + 2 = 18 dimanches au-delà du dixième, à 54,93 €.
    // Il a donc travaillé 28 dimanches en 2025, sous le plafond de 31.
    const montant = sundayAllowance(28);
    expect(montant.perSundayCount).toBe(18);
    expect(montant.perSundayTotal).toBeCloseTo(
      164.79 + 494.37 + 219.72 + 109.86,
      2,
    );
    expect(montant.total).toBeCloseTo(2063.79, 2);
    // Sous le plafond : aucun dimanche perdu cette année-là.
    expect(montant.unpaid).toBe(0);
  });
});

describe("fériés compensés (mise à disposition Grand Palais)", () => {
  /* Le Grand Palais ferme le lundi là où Pompidou fermait le mardi : un férié
     que le cycle aurait fait travailler tombe alors un jour fermé, et se paie
     en prime seule sur la paie de février suivante — ligne « Compens. Indem
     jf ac public n-1 » du bulletin.

     On attend 3 fériés sur la paie de février 2027, au titre de 2026. */
  const compensatedFor = (year: number, group: number) =>
    Object.keys(holidaysForYear(year))
      .map((key) => fromKey(key))
      .filter(
        (date) =>
          getDayInfo(date, group).kind !== "work" &&
          wasPompidouHolidayWorked(date, group),
      );

  it("trouve les 3 fériés compensés de 2026, payés en février 2027", () => {
    const compensated = compensatedFor(2026, 2);
    expect(compensated.map(dateKey)).toEqual([
      "2026-05-14", // Ascension
      "2026-05-25", // Lundi de Pentecôte
      "2026-12-25", // Noël
    ]);
    // Prime seule sur le traitement de 2026 : 3 × 262,06 €.
    expect(compensated.length * holidayAllowance(1855.88, "prime")).toBeCloseTo(
      786.19,
      2,
    );
  });

  it("ne compte pas un férié déjà travaillé", () => {
    // L'Assomption 2026 est travaillée : elle relève de la prime normale,
    // payée le mois suivant, pas de la compensation de février.
    const assomption = localDate(2026, 7, 15);
    expect(getDayInfo(assomption, 2).kind).toBe("work");
    expect(compensatedFor(2026, 2).map(dateKey)).not.toContain("2026-08-15");
  });
});

describe("indemnité de jour férié — seconde confirmation", () => {
  it("retrouve la compensation de février 2026, calculée sur le traitement 2025", () => {
    // Le bulletin de février 2026 porte « Compens. Indem jf ac public n-1 » à
    // 261,38 €, sur le traitement de 2025 qui valait 1850,96 €. La prime seule
    // se vérifie donc sur deux traitements différents, à un centime près.
    expect(holidayAllowance(1850.96, "prime")).toBeCloseTo(261.38, 1);
    expect(holidayAllowance(1855.88, "prime")).toBeCloseTo(262.06, 2);
  });
});

describe("retenue maladie", () => {
  // Arrêt du 3 au 14 janvier 2026 : 12 jours calendaires, dont un de carence.
  const traitement = 1850.96;
  const ifse = 416.66;
  const carence = 78.17;

  it("retrouve les deux retenues du bulletin de janvier 2026", () => {
    const retenue = sickLeaveDeduction(12, traitement, ifse, carence);
    expect(retenue.reducedDays).toBe(11);
    // Le bulletin détaille 11 × 6,17 € sur le traitement et 15,28 € sur l'IFSE.
    expect((traitement * 0.1) / 30).toBeCloseTo(6.17, 2);
    expect(((ifse * 0.1) / 30) * 11).toBeCloseTo(15.28, 2);
    expect(retenue.reduction).toBeCloseTo(67.87 + 15.28, 2);
    expect(retenue.total).toBeCloseTo(78.17 + 83.15, 2);
  });

  it("ne retient que la carence sur un arrêt d’un seul jour", () => {
    // Les arrêts de mars, juin et août 2024 n'ont porté que la carence.
    const retenue = sickLeaveDeduction(1, 1831.27, ifse, 77.5);
    expect(retenue.reducedDays).toBe(0);
    expect(retenue.reduction).toBe(0);
    expect(retenue.total).toBeCloseTo(77.5, 2);
  });

  it("ne retient rien sans arrêt", () => {
    expect(sickLeaveDeduction(0, traitement, ifse, carence).total).toBe(0);
  });
});
