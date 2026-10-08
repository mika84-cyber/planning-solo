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
    const html = renderToStaticMarkup(<MecenatHistoryList entries={[entry("a", "2026-10-12"), entry("b", "2026-10-14")]} onDelete={vi.fn()} today={new Date(2026, 9, 20)} />);
    expect(html).toMatch(/254,50\s€ brut · paie de novembre/);
    expect(html).toContain("mecenat-history-date");
    expect(html).toContain("<small>mer</small><b>14</b>");
    expect(html).toContain("19 h 30 – 0 h");
    expect(html).toContain("4 h 30 · dont 2 h de nuit");
    expect(html).toContain('aria-label="Supprimer : mercredi 14 octobre 2026"');
    expect(html).not.toContain("Paie de");
    // Dans l'ordre des dates.
    expect(html.indexOf(">12<")).toBeLessThan(html.indexOf(">14<"));
  });

  it("précise le mois de paie sur chaque ligne quand il diffère", () => {
    const html = renderToStaticMarkup(<MecenatHistoryList entries={[entry("a", "2026-10-02", 9), entry("b", "2026-10-14")]} onDelete={vi.fn()} />);
    expect(html).toMatch(/254,50\s€ brut<\/small>/);
    expect(html).toContain("paie d’octobre 2026");
    expect(html).toContain("paie de novembre 2026");
  });

  it("garde les mécénats passés au-dessus, en rouge, puis ceux à venir du plus proche au plus éloigné", () => {
    const html = renderToStaticMarkup(<MecenatHistoryList
      entries={[entry("a", "2026-10-15"), entry("b", "2026-10-12"), entry("c", "2026-10-14"), entry("d", "2026-10-02")]}
      onDelete={vi.fn()}
      today={new Date(2026, 9, 8)}
    />);
    const order = ["<b>2<", "<b>12<", "<b>14<", "<b>15<"].map((day) => html.indexOf(day));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Le mécénat passé est signalé.
    expect(html.match(/mecenat-history-row is-past/g)).toHaveLength(1);
    expect(html.match(/class="mecenat-done">✓ Fait</g)).toHaveLength(1);
  });
});
