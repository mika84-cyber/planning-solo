import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MealVouchersScreen } from "./MealVouchersScreen";
import { MEAL_VOUCHER_PRESETS } from "./mealVouchers";

const render = (props: Partial<Parameters<typeof MealVouchersScreen>[0]> = {}) =>
  renderToStaticMarkup(<MealVouchersScreen initialYear={2026} knownRetention={0} onSave={vi.fn()} {...props} />).replace(/[\u00a0\u202f]/g, " ");
const checked = (html: string) => [...html.matchAll(/aria-checked="true"[^>]*><strong>([^<]+)</g)].map((match) => match[1]);
const months = (html: string) => [...html.matchAll(/inputMode="numeric"[^>]*value="(\d+)"/g)].map((match) => Number(match[1]));

describe("l'écran des titres repas", () => {
  it("part de 20 titres par mois sans décembre, et demande la valeur du titre", () => {
    const html = render();
    expect(html).toContain("Par défaut : 20 par mois, rien en décembre");
    expect(months(html)).toEqual([20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 0]);
    expect(checked(html)).toEqual(["20 par mois"]);
    expect(html).toContain("220 titres sur 220");
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

  it("donne à chaque mois deux petites flèches, arrêtées à 20 et à 0", () => {
    const html = render();
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
    expect(checked(html)).toEqual(["9,90 €", "20 par mois"]);
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
    expect(checked(saved)).toEqual(["10,30 €", "18 par mois"]);
    expect(months(saved)).toEqual([18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 20, 20]);
    // Une confirmation qui dit comment changer de formule, pas un bouton éteint.
    expect(saved).toMatch(/role="status"><strong>Enregistré pour 2026<\/strong>/);
    expect(saved).toContain("Pour en changer, choisissez une autre formule");
    expect(saved).not.toContain(">Enregistrer<");
    const next = render({ plans, initialYear: 2027 });
    expect(next).toContain("Repris de votre dernier choix");
    expect(months(next)).toEqual([18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 20, 20]);
    expect(next).toMatch(/<button[^>]*primary-action[^>]*>Enregistrer</);
  });

  it("donne une répartition libre pour « Sur mesure »", () => {
    const counts = [20, 20, 20, 20, 20, 20, 0, 0, 20, 20, 20, 20];
    const html = render({ plans: { "2026": { faceCents: 990, counts } } });
    expect(checked(html)).toEqual(["9,90 €", "Sur mesure"]);
    expect(html).toContain("200 titres sur 220");
    expect(html).toContain("990,00 €");
  });
});
