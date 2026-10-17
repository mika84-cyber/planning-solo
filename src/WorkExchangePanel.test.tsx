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

  it("nomme les fériés d’un échange de fériés et prend le logo au dollar", () => {
    const html = renderToStaticMarkup(<WorkExchangePanel
      exchanges={[{ id: "noel", partnerName: "Camille", partnerGroup: 3, agreementDate: "2026-01-01", returnDate: "2026-04-05", updatedAt: "" }]}
      onEdit={() => undefined} />);
    expect(html).toContain("Camille vous remplace : Jour de l’an");
    expect(html).toContain("/holiday-exchange.png");
  });

  it("replie les échanges passés sous la liste et ne compte que ceux à venir", () => {
    const html = renderToStaticMarkup(<WorkExchangePanel
      today="2026-10-18"
      exchanges={[
        { id: "futur", partnerName: "Camille", partnerGroup: 1, agreementDate: "2026-11-03", returnDate: "2026-11-10", updatedAt: "" },
        { id: "passe", partnerName: "Adriana", partnerGroup: 3, agreementDate: "2026-09-18", returnDate: "2026-09-15", updatedAt: "" },
      ]}
      onEdit={() => undefined} />);
    expect(html).toContain("<strong>1</strong>");
    expect(html).toContain("Échanges passés · 1");
    expect(html.indexOf("Camille")).toBeLessThan(html.indexOf("<details"));
    expect(html.indexOf("Adriana")).toBeGreaterThan(html.indexOf("<details"));
  });
});
