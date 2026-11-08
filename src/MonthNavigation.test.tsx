import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MonthNavigation } from "./MonthNavigation";

describe("barre du mois en tête du calendrier", () => {
  it("pose le sélecteur du mois, l’année et les deux flèches", () => {
    const html = renderToStaticMarkup(<MonthNavigation year={2026} month={9} onStep={vi.fn()} onSelectMonth={vi.fn()} />);
    expect(html).toContain('<div class="month-card-nav"><button type="button" class="period-step" aria-label="Mois précédent">');
    // Le mois et l'année forment un seul bouton : le sélecteur du mois, l'année
    // en complément avant le chevron.
    expect(html).toContain('<div class="month-card-title" aria-live="polite"><div class="choice-picker month-card-picker"><button type="button" class="choice-picker-trigger" aria-label="Mois du calendrier" aria-expanded="false" aria-haspopup="listbox"><span>octobre</span> <span class="month-card-year">2026</span><svg');
    expect(html).toContain('</svg></button></div></div><button type="button" class="period-step" aria-label="Mois suivant">');
  });
});
