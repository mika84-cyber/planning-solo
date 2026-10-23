import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayMonthNav } from "./PayMonthNav";

describe("PayMonthNav", () => {
  it("met le mois entre ses deux flèches, avec « Paie de » au-dessus", () => {
    const html = renderToStaticMarkup(
      <PayMonthNav month={9} year={2026} onPreviousMonth={vi.fn()} onNextMonth={vi.fn()} onToday={vi.fn()} titleId="pay-dashboard-title" />,
    );
    expect(html).toContain('class="pay-bulletin-month pay-bulletin-month-nav" role="group" aria-label="Choisir le mois de paie"');
    expect(html).toMatch(/aria-label="Mois précédent"[\s\S]*Paie de[\s\S]*<h2 id="pay-dashboard-title">Octobre 2026<\/h2>[\s\S]*aria-label="Mois suivant"/);
  });

  it("propose de revenir à aujourd’hui seulement loin du mois en cours, et sait se faire h3", () => {
    const now = new Date();
    const current = renderToStaticMarkup(
      <PayMonthNav month={now.getMonth()} year={now.getFullYear()} onPreviousMonth={vi.fn()} onNextMonth={vi.fn()} onToday={vi.fn()} />,
    );
    expect(current).not.toContain("Revenir à aujourd’hui");
    const past = renderToStaticMarkup(
      <PayMonthNav month={0} year={2024} onPreviousMonth={vi.fn()} onNextMonth={vi.fn()} onToday={vi.fn()} heading="h3" titleId="variable-pay-title" />,
    );
    expect(past).toContain('<h3 id="variable-pay-title">Janvier 2024</h3>');
    expect(past).toContain('class="pay-bulletin-today">Revenir à aujourd’hui</button>');
  });
});
