import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MecenatHistoryList } from "./WorkTimeHistory";

const entry = (id: string, date: string, payMonth = 10) => ({
  id,
  date,
  start: "19:30",
  end: "00:00",
  dayMinutes: 150,
  nightMinutes: 120,
  grossAmountCents: 12725,
  payYear: 2026,
  payMonth,
  updatedAt: "",
});

describe("MecenatHistoryList", () => {
  it("liste les soirées du mois avec la date en éphéméride et le mois de paie dans l'en-tête", () => {
    const html = renderToStaticMarkup(<MecenatHistoryList entries={[entry("a", "2026-10-12"), entry("b", "2026-10-14")]} onDelete={vi.fn()} />);
    expect(html).toMatch(/254,50\s€ brut · paie de novembre/);
    expect(html).toContain("mecenat-history-date");
    expect(html).toContain("<small>mer</small><b>14</b>");
    expect(html).toContain("19 h 30 – 0 h");
    expect(html).toContain("4 h 30 · dont 2 h de nuit");
    expect(html).toContain('aria-label="Supprimer : mercredi 14 octobre 2026"');
    expect(html).not.toContain("Paie de");
    // La plus récente en premier.
    expect(html.indexOf(">14<")).toBeLessThan(html.indexOf(">12<"));
  });

  it("précise le mois de paie sur chaque ligne quand il diffère", () => {
    const html = renderToStaticMarkup(<MecenatHistoryList entries={[entry("a", "2026-10-02", 9), entry("b", "2026-10-14")]} onDelete={vi.fn()} />);
    expect(html).toMatch(/254,50\s€ brut<\/small>/);
    expect(html).toContain("paie d’octobre 2026");
    expect(html).toContain("paie de novembre 2026");
  });
});
