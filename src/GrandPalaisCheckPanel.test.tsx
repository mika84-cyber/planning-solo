import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckReport, checkProgress, GrandPalaisCheckPanel } from "./GrandPalaisCheckPanel";

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

  it("tient sur une ligne : le résultat en pastille près du titre, la date dessous, le bouton rond nommé", () => {
    const html = renderToStaticMarkup(
      <GrandPalaisCheckPanel lastCheckedAt={report.checkedAt} report={report} onPayload={vi.fn()} />,
    );
    expect(html).toContain("Dernier contrôle");
    expect(html).toMatch(/gp-watch-result is-pending">1 mise à jour ajoutée · 1 à valider</);
    expect(html).toContain('aria-label="Contrôler maintenant">Contrôler maintenant</button>');
    // Du nouveau : le point du radar s'allume.
    expect(html).toContain("grand-palais-check-panel gp-watch has-news");
    const clear = renderToStaticMarkup(
      <GrandPalaisCheckPanel lastCheckedAt={report.checkedAt} report={{ ...report, prices: [], proposals: [] }} onPayload={vi.fn()} />,
    );
    expect(clear).toMatch(/gp-watch-result is-clear">Rien de nouveau</);
    // Le radar, sans point allumé quand rien n'a changé.
    expect(clear).toContain('class="gp-watch-scope" aria-hidden="true"');
    expect(clear).not.toContain("has-news");
    expect(clear).toContain("<small>Dernier contrôle</small>");
    expect(clear).not.toContain("chaque nuit");
    expect(clear).not.toContain("Prochain passage");
    // Rien à lire : pas de bloc sous la ligne.
    expect(clear).not.toContain("gp-watch-body");
    expect(renderToStaticMarkup(<GrandPalaisCheckPanel onPayload={vi.fn()} />)).toContain("Aucun contrôle pour l’instant");
  });

  it("un contrôle lancé à la main s'arrête dès que le serveur note son échec", () => {
    const before = "2026-10-20T22:05:00.000Z";
    const requestedAt = "2026-10-21T17:46:50.000Z";
    const failure = { requestedAt, at: "2026-10-21T17:46:53.000Z", message: "Le site du Grand Palais est indisponible pour le moment." };
    // Rien de neuf : la lecture continue.
    expect(checkProgress({ lastCheckedAt: before }, { before, requestedAt })).toBeNull();
    // Le site en maintenance : l'échec de cette demande se dit tout de suite.
    expect(checkProgress({ lastCheckedAt: before, lastCheckFailure: failure }, { before, requestedAt }))
      .toEqual({ status: "failed", message: failure.message });
    // L'échec d'une demande précédente ne compte pas.
    expect(checkProgress({ lastCheckedAt: before, lastCheckFailure: { ...failure, requestedAt: "2026-10-21T16:43:52.000Z" } }, { before, requestedAt }))
      .toBeNull();
    // Une nouvelle date de contrôle l'emporte.
    expect(checkProgress({ lastCheckedAt: "2026-10-21T17:48:00.000Z", lastCheckFailure: failure }, { before, requestedAt }))
      .toEqual({ status: "done" });
  });
});
