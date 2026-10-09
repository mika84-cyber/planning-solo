import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckReport, GrandPalaisCheckPanel } from "./GrandPalaisCheckPanel";

const report = {
  checkedAt: "2026-10-09T22:00:00.000Z",
  prices: [{ title: "Paris Photo", kind: "new" as const, prices: [{ label: "Plein tarif", amount: 32 }, { label: "Moins de 18 ans", amount: 0 }] }],
  details: [],
  proposals: [{ kind: "new" as const, title: "Nouvelle exposition", venueLabel: "Grand Palais" }],
};

describe("veille du site du Grand Palais", () => {
  it("dit ce que l'application a ajouté et ce qui attend un accord", () => {
    const html = renderToStaticMarkup(<CheckReport report={report} />);
    expect(html).toContain("Ajouté par l’application");
    expect(html).toMatch(/Tarifs ajoutés pour « Paris Photo » : Plein tarif 32,00\s€, Moins de 18 ans gratuit\./);
    expect(html).toContain("À valider ci-dessous");
    expect(html).toContain("Nouveauté : « Nouvelle exposition » (Grand Palais).");
  });

  it("le dit aussi quand le contrôle n'a rien trouvé", () => {
    const html = renderToStaticMarkup(<CheckReport report={{ ...report, prices: [], proposals: [] }} />);
    expect(html).toContain("Rien de nouveau sur le site lors de ce contrôle.");
  });

  it("montre le compte rendu du dernier contrôle sous sa date", () => {
    const html = renderToStaticMarkup(
      <GrandPalaisCheckPanel lastCheckedAt={report.checkedAt} report={report} onPayload={vi.fn()} />,
    );
    expect(html).toContain("Tarifs ajoutés pour « Paris Photo »");
    // Un compte rendu d'un autre passage n'est pas montré.
    const stale = renderToStaticMarkup(
      <GrandPalaisCheckPanel lastCheckedAt="2026-10-10T22:00:00.000Z" report={report} onPayload={vi.fn()} />,
    );
    expect(stale).not.toContain("Paris Photo");
  });
});
