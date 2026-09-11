import { describe, expect, it } from "vitest";
import { monthGross, strikeDeduction } from "./payMonth";
import { strikePayEstimate } from "./strike";

/** Un mois ordinaire, sans arrêt ni grève : la base des variations testées. */
const moisType = {
  baseSalary: 2456.78,
  ifse: 512,
  otherFixed: 73.7,
  cia: 0,
  monthlyFlat: 89.59,
  sunday: 164.79,
  holiday: 0,
  compensated: 0,
  sickTotal: 0,
  strikeDeduction: 0,
  overtimeAmount: 0,
  mecenatGross: 0,
};

describe("bulletin réel de contractuel, février 2019", () => {
  // Bulletin Centre Pompidou, CDD art. 6 quater. Il sert de référence : le
  // modèle de l'application doit le reconstituer exactement.
  const bulletin = {
    ...moisType,
    baseSalary: 1733.82,
    // Une personne contractuelle n'a ni IFSE ni CIA.
    ifse: 0,
    cia: 0,
    // Indemnité de résidence, calculée automatiquement à 3 % du traitement.
    otherFixed: 52.01,
    // Le forfait dominical de l'époque.
    monthlyFlat: 76.24,
    sunday: 0,
    sickTotal: 59.53,
  };

  it("retrouve le CUMUL BRUT au centime", () => {
    expect(monthGross(bulletin).gross).toBeCloseTo(1802.54, 2);
  });

  it("déduit le jour de carence d’une personne contractuelle", () => {
    // Point vérifié sur le bulletin : la ligne « Jour de carence » y est bien
    // retenue (−59,53 €). L'application la mettait auparavant à zéro pour un
    // contractuel, ce qui surestimait sa paie.
    const sansCarence = monthGross({ ...bulletin, sickTotal: 0 });
    expect(sansCarence.gross - monthGross(bulletin).gross).toBeCloseTo(59.53, 2);
  });
});

describe("retenue de grève", () => {
  // La journée de grève se retient au 1/30 de la même façon pour les deux
  // statuts : l'application la mettait auparavant à zéro pour un contractuel.
  it("retient le montant estimé quel que soit le statut", () => {
    expect(strikeDeduction(84.31)).toBe(84.31);
  });

  it("ne retient rien quand l’estimation est impossible faute de traitement", () => {
    // `null` veut dire « on ne sait pas » : ne rien déduire vaut mieux que
    // deviner un montant.
    expect(strikeDeduction(null)).toBe(0);
  });

  it("diminue le brut du montant retenu", () => {
    const avecGreve = monthGross({
      ...moisType,
      strikeDeduction: strikeDeduction(84.31),
    });
    expect(monthGross(moisType).gross - avecGreve.gross).toBeCloseTo(84.31, 2);
  });
});

describe("composition du brut mensuel", () => {
  it("additionne le traitement, l’IFSE et les éléments fixes", () => {
    expect(monthGross(moisType).grossFixed).toBeCloseTo(3042.48, 2);
  });

  it("range les primes dans la part variable, hors pension civile", () => {
    // Le forfait dominical et les dimanches travaillés ne sont pas soumis à
    // la pension civile : ils doivent rester du côté variable.
    expect(monthGross(moisType).grossVariable).toBeCloseTo(254.38, 2);
  });

  it("garde le brut égal à la somme des deux parts", () => {
    // Invariant du bulletin : c'est ce qui rend le brut reconstituable
    // exactement, contrairement au net.
    const complet = monthGross({
      ...moisType,
      cia: 1420,
      holiday: 342.51,
      compensated: 61.2,
      overtimeAmount: 128.4,
      mecenatGross: 68.7,
      sickTotal: 187.42,
      strikeDeduction: 84.31,
    });
    expect(complet.gross).toBeCloseTo(
      complet.grossFixed + complet.grossVariable,
      2,
    );
  });

  it("retire la maladie et la grève du brut comme des primes", () => {
    const avecRetenues = monthGross({
      ...moisType,
      sickTotal: 187.42,
      strikeDeduction: 84.31,
    });
    expect(monthGross(moisType).gross - avecRetenues.gross).toBeCloseTo(
      187.42 + 84.31,
      2,
    );
    expect(monthGross(moisType).premiums - avecRetenues.premiums).toBeCloseTo(
      187.42 + 84.31,
      2,
    );
  });

  it("ne compte le CIA que sur son mois de versement", () => {
    // L'appelant passe déjà 0 sur les onze autres mois ; ce test fixe
    // l'effet attendu du montant lorsqu'il est présent.
    const avecCia = monthGross({ ...moisType, cia: 1420 });
    expect(avecCia.gross - monthGross(moisType).gross).toBeCloseTo(1420, 2);
    expect(avecCia.grossFixed).toBeCloseTo(monthGross(moisType).grossFixed, 2);
  });

  it("laisse les heures supplémentaires hors du total des primes", () => {
    // `premiums` sert à afficher les primes du mois ; les IHTS ont leur
    // propre ligne et ne doivent pas y être comptées deux fois.
    const avecHeures = monthGross({ ...moisType, overtimeAmount: 128.4 });
    expect(avecHeures.premiums).toBeCloseTo(monthGross(moisType).premiums, 2);
    expect(avecHeures.gross - monthGross(moisType).gross).toBeCloseTo(128.4, 2);
  });

  it("compte les mécénats dans les primes et dans le brut", () => {
    const avecMecenat = monthGross({ ...moisType, mecenatGross: 68.7 });
    expect(avecMecenat.premiums - monthGross(moisType).premiums).toBeCloseTo(68.7, 2);
    expect(avecMecenat.gross - monthGross(moisType).gross).toBeCloseTo(68.7, 2);
  });
});

describe("portée de la correction pour une personne contractuelle", () => {
  // La retenue maladie et la retenue de grève ne s'appliquaient pas aux
  // contractuels. Les rétablir ne change rien tant qu'aucun arrêt ni aucune
  // grève n'est posé : c'est la question que pose toute personne concernée,
  // et la réponse doit rester vraie.
  it("ne change rien à un mois ordinaire", () => {
    const ordinaire = { ...moisType, sickTotal: 0, strikeDeduction: 0 };
    expect(monthGross(ordinaire).gross).toBe(monthGross(moisType).gross);
  });

  it("sans grève enregistrée, la retenue vaut zéro et non « inconnu »", () => {
    // Une estimation à `null` signifierait « impossible à calculer » ; ici
    // le calcul est possible et donne zéro.
    const estimation = strikePayEstimate(
      [],
      1,
      { "2026": { baseSalary: 1733.82, residenceAllowance: 52.01 } },
      2026,
      8,
    );
    expect(estimation.days).toHaveLength(0);
    expect(estimation.totalDeduction).toBe(0);
    expect(strikeDeduction(estimation.totalDeduction)).toBe(0);
  });

  it("l’écart n’apparaît qu’avec un arrêt réellement posé", () => {
    const avecArret = monthGross({ ...moisType, sickTotal: 59.53 });
    expect(monthGross(moisType).gross - avecArret.gross).toBeCloseTo(59.53, 2);
  });
});
