import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MonthNavigation, MonthPanelYear, monthOptions } from "./MonthNavigation";

describe("barre du mois en tête du calendrier", () => {
  it("pose le titre du mois, l’année et les deux flèches, le panneau fermé", () => {
    const html = renderToStaticMarkup(<MonthNavigation year={2026} month={9} onStep={vi.fn()} onSelect={vi.fn()} onToday={vi.fn()} />);
    expect(html).toContain('<div class="month-card-nav"><button type="button" class="period-step" aria-label="Mois précédent">');
    // Le mois et l'année forment un seul bouton, qui ouvre le panneau du mois ;
    // l'année précède le chevron.
    expect(html).toContain('<div class="month-card-title" aria-live="polite"><div class="choice-picker month-card-picker"><button type="button" class="choice-picker-trigger" aria-label="Mois du calendrier" aria-expanded="false" aria-haspopup="dialog"><span>octobre</span> <span class="month-card-year">2026</span><svg');
    expect(html).toContain('</svg></button></div></div><button type="button" class="period-step" aria-label="Mois suivant">');
    // Fermé, rien du panneau n'est rendu.
    expect(html).not.toContain("month-period-year");
    expect(html).not.toContain("Aujourd’hui");
  });

  it("marque le mois d’aujourd’hui parmi les douze, dans son année seulement", () => {
    const options = monthOptions(2026, new Date(2026, 10, 9));
    expect(options).toHaveLength(12);
    expect(options[0]).toEqual({ value: 0, label: "janvier", current: false, className: undefined });
    expect(options[10]).toEqual({ value: 10, label: "novembre", current: true, className: "today-month" });
    expect(options[11]).toEqual({ value: 11, label: "décembre", current: false, className: undefined });
    expect(monthOptions(2027, new Date(2026, 10, 9)).some((option) => option.current)).toBe(false);
  });

  it("entoure l’année de ses deux flèches en tête du panneau", () => {
    const html = renderToStaticMarkup(<MonthPanelYear year={2026} onStep={vi.fn()} />);
    expect(html).toContain('<div class="month-period-year"><button type="button" aria-label="Année précédente">');
    expect(html).toContain('<strong>2026</strong><button type="button" aria-label="Année suivante">');
  });
});
