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
    expect(html).toContain("Adriana - Groupe 1");
    expect(html.indexOf("Vous la remplacez le mardi 15 septembre 2026"))
      .toBeLessThan(html.indexOf("Adriana vous remplace le vendredi 18 septembre 2026"));
  });
});
