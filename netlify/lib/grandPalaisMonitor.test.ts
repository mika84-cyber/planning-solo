import { describe, expect, it } from "vitest";
import {
  collectGrandPalaisEvents,
  detectGrandPalaisChanges,
  extractGrandPalaisEvent,
  extractGrandPalaisExceptionalClosures,
  extractGrandPalaisProgramLinks,
  extractGrandPalaisProgramPageLinks,
  isGrandPalaisProposalRelevant,
} from "./grandPalaisMonitor.mts";

const eventPage = (overrides: Record<string, string> = {}) => `
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Event",
    name: overrides.name || "Exposition test",
    startDate: overrides.startDate || "2027-04-02",
    endDate: overrides.endDate || "2027-07-30",
    url: overrides.url || "https://www.grandpalais.fr/fr/programme/exposition-test",
  })}</script>
  <div class="sidebar"><div class="infos wysiwyg-content">
    <p><span class="icon-map-pin"></span>&nbsp;${overrides.venue || "Galerie 8"}</p>
  </div></div>`;

describe("surveillance de la programmation du Grand Palais", () => {
  it("déduplique les liens du programme officiel", () => {
    const html = `
      <a href="/fr/programme/exposition-test">Test</a>
      <a href="/fr/programme/exposition-test">Test répété</a>
      <a href="/fr/visite">Visite</a>`;
    expect(extractGrandPalaisProgramLinks(html)).toEqual([
      "https://www.grandpalais.fr/fr/programme/exposition-test",
    ]);
  });

  it("ignore les liens de programme qui quittent le site officiel", () => {
    const html = `
      <a href="https://example.test/fr/programme/piege">Piège</a>
      <a href="/fr/programme/exposition-test">Officiel</a>`;
    expect(extractGrandPalaisProgramLinks(html)).toEqual([
      "https://www.grandpalais.fr/fr/programme/exposition-test",
    ]);
  });

  it("repère toutes les pages de la programmation officielle", () => {
    const html = `
      <a href="?page=0">1</a>
      <a href="?page=1">2</a>
      <a href="/fr/programme?page=2&amp;source=pager">3</a>
      <a href="https://example.test/fr/programme?page=3">Piège</a>`;
    expect(extractGrandPalaisProgramPageLinks(html)).toEqual([
      "https://www.grandpalais.fr/fr/programme",
      "https://www.grandpalais.fr/fr/programme?page=1",
      "https://www.grandpalais.fr/fr/programme?page=2",
    ]);
  });

  it("extrait les dates, le titre et la galerie depuis une fiche", () => {
    expect(extractGrandPalaisEvent(eventPage(), "https://www.grandpalais.fr/fr/programme/exposition-test"))
      .toMatchObject({
        title: "Exposition test",
        startDate: "2027-04-02",
        endDate: "2027-07-30",
        venueKey: "gallery8",
        venueLabel: "Galerie 8",
      });
  });

  it("remplace une URL JSON-LD externe par l’adresse officielle de la fiche", () => {
    expect(extractGrandPalaisEvent(
      eventPage({ url: "https://example.test/redirection" }),
      "https://www.grandpalais.fr/fr/programme/exposition-test",
    )?.url).toBe("https://www.grandpalais.fr/fr/programme/exposition-test");
  });

  it("refuse une page officielle anormalement volumineuse", async () => {
    const fetcher = async () => new Response("trop grand", {
      status: 200,
      headers: { "content-length": String(4 * 1024 * 1024) },
    });
    await expect(collectGrandPalaisEvents(fetcher as typeof fetch))
      .rejects.toThrow("trop volumineuse");
  });

  it("classe un nouvel espace dans Autres sans l’afficher avant validation", () => {
    expect(extractGrandPalaisEvent(eventPage({ venue: "Salon d’honneur" }), "https://www.grandpalais.fr/fr/programme/exposition-test"))
      .toMatchObject({ venueKey: "other:salon-honneur", venueLabel: "Salon d’honneur" });
  });

  it("détecte une galerie encore absente de l’application", () => {
    expect(extractGrandPalaisEvent(eventPage({ venue: "Galeries 2.2" }), "https://www.grandpalais.fr/fr/programme/exposition-test"))
      .toMatchObject({ venueKey: "other:galeries-2-2", venueLabel: "Galeries 2.2" });
  });

  it("ne propose ni une page générale ni une exposition déjà intégrée", () => {
    const grandPalaisSummer = extractGrandPalaisEvent(eventPage({
      name: "Grand Palais d'été",
      startDate: "2026-06-02",
      endDate: "2026-09-06",
      url: "https://www.grandpalais.fr/fr/programme/grand-palais-dete-2026",
    }), "https://www.grandpalais.fr/fr/programme/grand-palais-dete-2026");
    const artBasel = extractGrandPalaisEvent(eventPage({
      name: "Art Basel Paris 2026",
      startDate: "2026-10-23",
      endDate: "2026-10-25",
      url: "https://www.grandpalais.fr/fr/programme/art-basel-paris-2026",
      venue: "Nef",
    }), "https://www.grandpalais.fr/fr/programme/art-basel-paris-2026");
    expect(grandPalaisSummer && isGrandPalaisProposalRelevant(grandPalaisSummer)).toBe(false);
    expect(artBasel && isGrandPalaisProposalRelevant(artBasel)).toBe(false);
  });

  it("n’attribue pas toutes les Journées du patrimoine à l’auditorium", () => {
    expect(extractGrandPalaisEvent(eventPage({
      name: "Journées européennes du patrimoine 2026",
      startDate: "2026-09-19",
      endDate: "2026-09-20",
      url: "https://www.grandpalais.fr/fr/programme/journees-europeennes-du-patrimoine-2026",
      venue: "Grand Auditorium",
    }), "https://www.grandpalais.fr/fr/programme/journees-europeennes-du-patrimoine-2026"))
      .toMatchObject({ venueKey: "other:grand-palais", venueLabel: "Grand Palais" });
  });

  it("conserve tous les espaces officiels de la Fête de la science", () => {
    expect(extractGrandPalaisEvent(eventPage({
      name: "Fête de la science 2026",
      startDate: "2026-10-03",
      endDate: "2026-10-04",
      url: "https://www.grandpalais.fr/fr/programme/fete-de-la-science-2026",
      venue: "Salon Seine",
    }), "https://www.grandpalais.fr/fr/programme/fete-de-la-science-2026"))
      .toMatchObject({
        venueKey: "other:rotonde-salon-seine-palais-enfants",
        venueLabel: "Rotonde d’Antin, Salon Seine et Palais des enfants",
      });
  });

  it("reconnaît aussi les variantes plurielles des galeries existantes", () => {
    expect(extractGrandPalaisEvent(eventPage({ venue: "Galeries 8" }), "https://www.grandpalais.fr/fr/programme/exposition-test"))
      .toMatchObject({ venueKey: "gallery8", venueLabel: "Galerie 8" });
  });

  it("classe un autre espace nommé dans Autres", () => {
    expect(extractGrandPalaisEvent(eventPage({ venue: "Rotonde d’Antin" }), "https://www.grandpalais.fr/fr/programme/exposition-test"))
      .toMatchObject({ venueKey: "other:rotonde-d-antin", venueLabel: "Rotonde d’Antin" });
  });

  it("collecte aussi les événements des pages suivantes", async () => {
    const pages: Record<string, string> = {
      "https://www.grandpalais.fr/fr/programme": `
        <a href="/fr/programme/exposition-premiere">Première</a>
        <a href="?page=1">Suivante</a>`,
      "https://www.grandpalais.fr/fr/programme?page=1": `
        <a href="?page=0">Précédente</a>
        <a href="/fr/programme/exposition-galerie-2">Galerie 2</a>`,
      "https://www.grandpalais.fr/fr/programme/exposition-premiere": eventPage({
        name: "Première exposition",
        url: "https://www.grandpalais.fr/fr/programme/exposition-premiere",
      }),
      "https://www.grandpalais.fr/fr/programme/exposition-galerie-2": eventPage({
        name: "Exposition Galerie 2",
        url: "https://www.grandpalais.fr/fr/programme/exposition-galerie-2",
        venue: "Galeries 2.2",
      }),
      "https://www.grandpalais.fr/fr/informations-pratiques": "<main>Aucune fermeture</main>",
    };
    const fetcher = async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return new Response(pages[url] ?? "", { status: pages[url] === undefined ? 404 : 200 });
    };
    const events = await collectGrandPalaisEvents(fetcher as typeof fetch);
    expect(events.map((event) => event.title)).toEqual([
      "Première exposition",
      "Exposition Galerie 2",
    ]);
  });

  it("détecte seulement les fermetures complètes du Grand Palais", () => {
    const closures = extractGrandPalaisExceptionalClosures(`
      <p>Fermeture exceptionnelle : les 9, 10 et 26 septembre 2026.</p>
      <p>Fermeture anticipée à 18h les 24 et 31 décembre.</p>
      <p>Fermeture exceptionnelle des librairies-boutiques le 7 juillet 2026.</p>
    `, "https://www.grandpalais.fr/fr/informations-pratiques", 2026);
    expect(closures.map((item) => item.startDate)).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-26",
    ]);
    expect(closures.every((item) => item.venueKey === "exceptional-closure")).toBe(true);
  });

  it("déplie une fermeture complète annoncée sur plusieurs jours", () => {
    const closures = extractGrandPalaisExceptionalClosures(
      "<p>Fermeture exceptionnelle : du 31 août au 4 septembre 2026.</p>",
      "https://www.grandpalais.fr/fr/informations-pratiques",
      2026,
    );
    expect(closures.map((item) => item.startDate)).toEqual([
      "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
    ]);
  });

  it("crée des propositions seulement après le premier relevé", () => {
    const first = extractGrandPalaisEvent(eventPage(), "https://www.grandpalais.fr/fr/programme/exposition-test");
    expect(first).not.toBeNull();
    if (!first) return;
    const baseline = detectGrandPalaisChanges(null, [first], "2026-08-28T06:00:00.000Z");
    expect(baseline.proposals).toEqual([]);
    const changed = { ...first, endDate: "2027-08-15" };
    const next = detectGrandPalaisChanges(baseline.state, [changed], "2026-08-29T06:00:00.000Z");
    expect(next.proposals).toHaveLength(1);
    expect(next.proposals[0]).toMatchObject({ kind: "changed", previous: first, next: changed });
  });

  it("attend deux relevés absents avant de proposer un retrait", () => {
    const event = extractGrandPalaisEvent(eventPage(), "https://www.grandpalais.fr/fr/programme/exposition-test");
    expect(event).not.toBeNull();
    if (!event) return;
    const baseline = detectGrandPalaisChanges(null, [event], "2026-08-28T06:00:00.000Z");
    const firstMiss = detectGrandPalaisChanges(baseline.state, [], "2026-08-29T06:00:00.000Z");
    expect(firstMiss.proposals).toEqual([]);
    const secondMiss = detectGrandPalaisChanges(firstMiss.state, [], "2026-08-30T06:00:00.000Z");
    expect(secondMiss.proposals[0]).toMatchObject({ kind: "removed", previous: event });
  });
});
