import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MealVouchersScreen } from "./MealVouchersScreen";
import { MEAL_VOUCHER_PRESETS } from "./mealVouchers";

const render = (props: Partial<Parameters<typeof MealVouchersScreen>[0]> = {}) =>
  renderToStaticMarkup(<MealVouchersScreen initialYear={2026} knownRetention={0} onSave={vi.fn()} {...props} />).replace(/[\u00a0\u202f]/g, " ");
/** Les choix cochés : le nom lu (aria-label) d'une carte, sinon son intitulé. */
const checked = (html: string) => [...html.matchAll(/<button[^>]*aria-checked="true"[^>]*>[^]*?<\/button>/g)].map((match) =>
  /aria-label="([^"]+)"/.exec(match[0])?.[1] ?? /<strong>([^<]+)<\/strong>/.exec(match[0])?.[1]);
/** La courbe de chaque carte de modèle : la hauteur de ses douze barres, en %. */
const curves = (html: string) => [...html.matchAll(/class="meal-vouchers-curve"[^>]*>([^]*?)<\/span>/g)].map((match) =>
  [...match[1].matchAll(/height:(\d+(?:\.\d+)?)%/g)].map((bar) => Number(bar[1])));
const months = (html: string) => [...html.matchAll(/inputMode="numeric"[^>]*value="(\d+)"/g)].map((match) => Number(match[1]));

describe("l'écran des titres repas", () => {
  it("part de 20 titres par mois sans décembre, et demande la valeur du titre", () => {
    const html = render();
    expect(html).toContain("Par défaut : 20 par mois, rien en décembre");
    expect(checked(html)).toEqual(["20 par mois, rien en décembre"]);
    // Un modèle choisi : ses douze mois se lisent sur sa carte, sans cases à saisir.
    expect(months(html)).toEqual([]);
    expect(curves(html)).toEqual([
      [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0],
      [90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 100, 100],
    ]);
    // Sans valeur, ni part à afficher ni enregistrement possible.
    expect(html).toContain("Choisissez d’abord la valeur de votre titre.");
    expect(html).not.toContain("Votre part sur l’année");
    // Le bouton répond : un clic sans valeur dit ce qui manque, au lieu de ne rien faire.
    expect(html).toMatch(/<button[^>]*primary-action[^>]*>Enregistrer</);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Enregistrer</);
  });

  it("propose les deux valeurs, leur indice et la part de l'agent", () => {
    const html = render();
    for (const text of ["10,30 €", "Indices &lt; 427", "Votre part : 4,12 €", "9,90 €", "Indices 428 à 604", "Votre part : 4,95 €"])
      expect(html).toContain(text);
    expect(html).not.toContain("6,50 €");
    expect(html).not.toContain("3,70 €");
  });

  it("dit à qui écrire pour changer son nombre de titres", () => {
    const html = render();
    expect(html).toContain("Pour changer votre nombre de titres par mois, écrivez à");
    expect(html).toContain('<a href="mailto:bimpli@centrepompidou.fr">bimpli@centrepompidou.fr</a>');
    // Dans l'encadré des mois, avant le choix de la répartition.
    const mail = html.indexOf('href="mailto:bimpli@centrepompidou.fr"');
    expect(mail).toBeGreaterThan(html.indexOf("Vos titres, mois par mois"));
    expect(mail).toBeLessThan(html.indexOf("meal-vouchers-presets"));
  });

  it("mène d’un toucher aux horaires de retrait, aux formulaires et au contact, sous l’année", () => {
    const html = render();
    const rows = [...html.matchAll(/<button type="button"><b aria-hidden="true"><svg[^]*?<\/svg><\/b><span><strong>([^<]+)<\/strong><small>([^<]+)<\/small><\/span><i aria-hidden="true">›<\/i><\/button>/g)].map((match) => [match[1], match[2]]);
    expect(rows).toEqual([
      ["Horaires de retrait", "Guichet des titres repas"],
      ["Formulaires", "Carte BIMPLI, procuration de retrait"],
      ["Contact titres repas", "01 44 78 41 48 · bimpli@centrepompidou.fr"],
    ]);
    // Juste sous l'année, avant la valeur du titre.
    expect(html.indexOf('class="meal-vouchers-links"')).toBeGreaterThan(html.indexOf("meal-vouchers-head"));
    expect(html.indexOf('class="meal-vouchers-links"')).toBeLessThan(html.indexOf("La valeur de votre titre"));
  });

  it("présente les deux modèles en cartes, et « Sur mesure » à part", () => {
    const html = render();
    const cards = [...html.matchAll(/class="meal-vouchers-model" aria-checked="(true|false)" aria-label="([^"]+)">[^]*?class="meal-vouchers-number">(\d+)<small>par mois<\/small>[^]*?class="meal-vouchers-model-note"><b>([^<]+)<\/b>(\d+) titres sur l’année/g)]
      .map((match) => match.slice(1));
    expect(cards).toEqual([
      ["true", "20 par mois, rien en décembre", "20", "Rien en décembre", "220"],
      ["false", "18 par mois, 20 en novembre et décembre", "18", "20 en nov. et déc.", "220"],
    ]);
    expect(html).toMatch(/class="meal-vouchers-custom" aria-checked="false"><b aria-hidden="true"><svg[^]*?<\/svg><\/b><span><strong>Sur mesure<\/strong><small>Le nombre de votre choix, mois par mois<\/small><\/span>/);
    // Plus de carte « Sur l’année » à part : la part de l'année reste sous la répartition.
    expect(html).not.toContain("meal-vouchers-total");
    expect(html).not.toContain("titres sur 220");
    expect(html).toContain("Votre part est retenue sur la paie du mois où vous prenez les titres.");
  });

  it("donne à chaque mois deux petites flèches, arrêtées à 20 et à 0", () => {
    // Une répartition libre, qui montre les douze cases : novembre à 20, décembre à 0.
    const html = render({ plans: { "2026": { faceCents: 990, counts: [19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 0] } } });
    expect(html.match(/aria-label="Un titre de plus en /g)).toHaveLength(12);
    expect(html.match(/aria-label="Un titre de moins en /g)).toHaveLength(12);
    // Novembre, à 20, ne monte plus ; décembre, à 0, ne descend plus.
    expect(html).toMatch(/aria-label="Un titre de plus en novembre" disabled=""/);
    expect(html).not.toMatch(/aria-label="Un titre de moins en novembre" disabled=""/);
    expect(html).toMatch(/aria-label="Un titre de moins en décembre" disabled=""/);
    expect(html).not.toMatch(/aria-label="Un titre de plus en décembre" disabled=""/);
  });

  it("reconnaît la valeur du titre d'après la retenue du bulletin", () => {
    const html = render({ knownRetention: 99 });
    expect(checked(html)).toEqual(["9,90 €", "20 par mois, rien en décembre"]);
    expect(html).toContain("Votre part sur l’année");
    expect(html).toContain("1 089,00 €");
    expect(html).not.toContain("Choisissez d’abord");
    expect(html).toMatch(/<button[^>]*primary-action[^>]*>Enregistrer</);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Enregistrer</);
  });

  it("montre le choix enregistré, et sa reprise l'année suivante", () => {
    const plans = { "2026": { faceCents: 1030, counts: MEAL_VOUCHER_PRESETS[1].counts } };
    const saved = render({ plans });
    expect(saved).toContain("Enregistré pour 2026");
    expect(checked(saved)).toEqual(["10,30 €", "18 par mois, 20 en novembre et décembre"]);
    expect(months(saved)).toEqual([]);
    // Une confirmation qui dit comment changer de formule, pas un bouton éteint.
    expect(saved).toMatch(/role="status"><strong>Enregistré pour 2026<\/strong>/);
    expect(saved).toContain("Pour en changer, choisissez une autre formule");
    expect(saved).not.toContain(">Enregistrer<");
    const next = render({ plans, initialYear: 2027 });
    expect(next).toContain("Repris de votre dernier choix");
    expect(checked(next)).toEqual(["10,30 €", "18 par mois, 20 en novembre et décembre"]);
    expect(next).toMatch(/<button[^>]*primary-action[^>]*>Enregistrer</);
  });

  it("donne une répartition libre pour « Sur mesure »", () => {
    const counts = [20, 20, 20, 20, 20, 20, 0, 0, 20, 20, 20, 20];
    const html = render({ plans: { "2026": { faceCents: 990, counts } } });
    expect(checked(html)).toEqual(["9,90 €", "Sur mesure"]);
    // Les douze cases s'ouvrent, et le compte de l'année revient sous elles.
    expect(months(html)).toEqual(counts);
    expect(html).toContain("200 titres sur 220");
    expect(html.indexOf("200 titres sur 220")).toBeGreaterThan(html.indexOf("meal-vouchers-months"));
    expect(html).toContain("990,00 €");
  });
});
