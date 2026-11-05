import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEAL_VOUCHER_COUNTS,
  faceCentsFromRetention,
  MEAL_VOUCHER_PRESETS,
  mealVoucherAgentPart,
  mealVoucherPlanFor,
  mealVoucherRetention,
  mealVoucherTotal,
  mealVoucherWaived,
  sanitizeMealVoucherPlans,
} from "./mealVouchers";

const spread = MEAL_VOUCHER_PRESETS[1].counts;

describe("les titres repas", () => {
  it("sans rien de renseigné, compte 20 titres par mois et rien en décembre", () => {
    expect(mealVoucherTotal(DEFAULT_MEAL_VOUCHER_COUNTS)).toBe(220);
    expect(DEFAULT_MEAL_VOUCHER_COUNTS[10]).toBe(20);
    expect(DEFAULT_MEAL_VOUCHER_COUNTS[11]).toBe(0);
    // Le montant connu du bulletin, onze mois sur douze.
    expect(mealVoucherRetention(null, 0, 82.4)).toBe(82.4);
    expect(mealVoucherRetention(null, 10, 82.4)).toBe(82.4);
    expect(mealVoucherRetention(null, 11, 82.4)).toBe(0);
    // Décembre le signale : la retenue d'un mois ordinaire, barrée.
    expect(mealVoucherWaived(null, 11, 82.4)).toBe(82.4);
    expect(mealVoucherWaived(null, 5, 82.4)).toBe(0);
  });

  it("retient le nombre de titres du mois à la part de l'agent, décembre compris", () => {
    const plan = { faceCents: 990, counts: spread };
    expect(mealVoucherTotal(spread)).toBe(220);
    expect(mealVoucherAgentPart(plan)).toBe(4.95);
    expect(mealVoucherRetention(plan, 0, 82.4)).toBe(89.1);
    expect(mealVoucherRetention(plan, 10, 82.4)).toBe(99);
    expect(mealVoucherRetention(plan, 11, 82.4)).toBe(99);
    expect(mealVoucherWaived(plan, 11, 82.4)).toBe(0);
    // L'autre valeur a sa part : 20 titres à 10,30 €.
    expect(mealVoucherRetention({ faceCents: 1030, counts: spread }, 11, 0)).toBe(82.4);
  });

  it("une fois enregistré, le choix l'emporte sur le montant déjà renseigné, mois par mois", () => {
    // 18 titres à 10,30 € : 18 × 4,12 € = 74,16 €, quel que soit le montant du profil.
    const counts = [18, 20, 0, 18, 20, 18, 18, 18, 20, 20, 20, 20];
    const plan = { faceCents: 1030, counts };
    for (const manual of [0, 50, 82.4, 99]) {
      expect(mealVoucherRetention(plan, 0, manual)).toBe(74.16);
      expect(mealVoucherRetention(plan, 1, manual)).toBe(82.4);
      expect(mealVoucherRetention(plan, 2, manual)).toBe(0);
      expect(mealVoucherRetention(plan, 11, manual)).toBe(82.4);
    }
    // Sans choix enregistré, le montant renseigné reste celui de la paie.
    expect(mealVoucherRetention(null, 0, 50)).toBe(50);
  });

  it("signale un mois sans titre, quel qu'il soit, à la retenue d'un mois ordinaire", () => {
    const august = { faceCents: 990, counts: spread.map((count, month) => (month === 7 ? 0 : count)) };
    expect(mealVoucherRetention(august, 7, 0)).toBe(0);
    expect(mealVoucherWaived(august, 7, 0)).toBe(99);
    expect(mealVoucherWaived(august, 6, 0)).toBe(0);
  });

  it("reprend le dernier choix pour les années suivantes, jamais pour les précédentes", () => {
    const plans = { "2026": { faceCents: 990, counts: spread }, "2028": { faceCents: 1030, counts: DEFAULT_MEAL_VOUCHER_COUNTS } };
    expect(mealVoucherPlanFor(plans, 2025)).toBeNull();
    expect(mealVoucherPlanFor(plans, 2026)).toBe(plans["2026"]);
    expect(mealVoucherPlanFor(plans, 2027)).toBe(plans["2026"]);
    expect(mealVoucherPlanFor(plans, 2029)).toBe(plans["2028"]);
    expect(mealVoucherPlanFor(undefined, 2026)).toBeNull();
  });

  it("retrouve la valeur du titre d'après la retenue lue sur un bulletin", () => {
    expect(faceCentsFromRetention(82.4)).toBe(1030);
    expect(faceCentsFromRetention(99)).toBe(990);
    expect(faceCentsFromRetention(89.1)).toBe(990);
    // Une retenue qui ne vient d'aucune des deux valeurs : rien de présélectionné.
    expect(faceCentsFromRetention(65)).toBeUndefined();
    expect(faceCentsFromRetention(0)).toBeUndefined();
    expect(faceCentsFromRetention(71.13)).toBeUndefined();
  });

  it("n'accepte que des choix conformes aux droits", () => {
    const good = { faceCents: 990, counts: spread };
    expect(sanitizeMealVoucherPlans({ "2026": good })).toEqual({ "2026": good });
    expect(sanitizeMealVoucherPlans(null)).toEqual({});
    expect(sanitizeMealVoucherPlans([good])).toEqual({});
    expect(sanitizeMealVoucherPlans({
      // Une année mal écrite, une valeur retirée, un mois manquant.
      "20-26": good,
      "2027": { faceCents: 650, counts: spread },
      "2028": { faceCents: 990, counts: spread.slice(1) },
      // Plus de 20 titres un mois, un nombre négatif ou décimal.
      "2029": { faceCents: 990, counts: [21, ...spread.slice(1)] },
      "2030": { faceCents: 990, counts: [-1, ...spread.slice(1)] },
      "2031": { faceCents: 990, counts: [1.5, ...spread.slice(1)] },
      // Plus de 220 titres sur l'année.
      "2032": { faceCents: 990, counts: Array.from({ length: 12 }, () => 20) },
    })).toEqual({});
  });
});
