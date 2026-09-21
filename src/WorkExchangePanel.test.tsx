import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkExchangePanel } from "./WorkExchangePanel";

describe("WorkExchangePanel", () => {
  it("présente les deux remplacements dans leur ordre chronologique", () => {
    const html = renderToStaticMarkup(
      <WorkExchangePanel
        exchanges={[{
          id: "exchange-a",
          partnerName: "Adriana",
          partnerGroup: 1,
          agreementDate: "2026-09-18",
          returnDate: "2026-09-15",
          updatedAt: "v1",
        }]}
        onEdit={vi.fn()}
      />,
    );
    expect(html).toContain("<strong>Adriana</strong>");
    expect(html).toContain("Groupe 1");
    // Le jour repris porte l'étiquette TRAVAIL, le jour cédé l'étiquette OFF.
    expect(html).toMatch(/exchange-return"><b aria-hidden="true">Travail<\/b><p>Vous la remplacez/);
    expect(html).toMatch(/exchange-given"><b aria-hidden="true">Off<\/b><p>Adriana vous remplace/);
    expect(html.indexOf("Vous la remplacez le mardi 15 septembre 2026"))
      .toBeLessThan(html.indexOf("Adriana vous remplace le vendredi 18 septembre 2026"));
  });
});
