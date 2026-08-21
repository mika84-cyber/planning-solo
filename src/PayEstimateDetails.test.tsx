import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayEstimateDetails } from "./PayEstimateDetails";

describe("détail mensuel de la paie", () => {
  it("affiche le mois, le brut, le net et les commandes de navigation", () => {
    const html = renderToStaticMarkup(
      <PayEstimateDetails
        monthIndex={7}
        year={2026}
        gross={2500}
        grossEstimateComplete
        net={1980}
        rows={[
          { key: "base", label: "Traitement de base", detail: "mensuel", amount: 2000 },
        ]}
        overtime={{
          totalMinutes: 0,
          performedMonth: 6,
          performedYear: 2026,
          ready: false,
          amount: 0,
          hourlyBase: 0,
          lines: [],
        }}
        workQuota="full"
        mecenat={{ grossAmountCents: 0, lines: [] }}
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
      />,
    );

    expect(html).toContain("Détail de la paie du mois affiché");
    expect(html).toContain("août 2026");
    expect(html).toContain("2 500,00 €");
    expect(html).toContain("1 980,00 €");
    expect(html).toContain('aria-label="Mois précédent"');
    expect(html).toContain('aria-label="Mois suivant"');
  });
});
