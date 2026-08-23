import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestValidationSummary } from "./RequestValidationSummary";

describe("résumé avant validation", () => {
  it("reste absent tant qu’aucune date n’est sélectionnée", () => {
    expect(
      renderToStaticMarkup(
        <RequestValidationSummary
          items={[]}
          requestKind="leave"
          sickRequest={false}
        />,
      ),
    ).toBe("");
  });

  it("récapitule les dates, les types, les horaires et l’impact", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[
          { date: "2026-08-11", type: "annual" },
          {
            date: "2026-08-12",
            type: "recovery_hours",
            start: "09:00",
            end: "11:00",
          },
        ]}
        requestKind="recovery"
        sickRequest={false}
      />,
    );

    expect(html).toContain("Résumé avant validation");
    expect(html).toContain("2 dates");
    expect(html).toContain("mardi 11 août 2026");
    expect(html).toContain("09:00");
    expect(html).toContain("11:00");
    expect(html).toContain("Déduit du solde d’heures de récupération");
  });

  it("explique que Divers ne modifie ni la paie ni les soldes", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-13", type: "other" }]}
        requestKind="other"
        sickRequest={false}
      />,
    );

    expect(html).toContain("Repère visible uniquement dans le planning");
    expect(html).toContain("sans effet sur la paie ni les soldes");
  });

  it("explique la retenue de grève sans déduction de congé", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-13", type: "strike" }]}
        requestKind="strike"
        sickRequest={false}
      />,
    );
    expect(html).toContain("retenue brute estimée au trentième");
    expect(html).toContain("sans effet sur les soldes");
  });
});
