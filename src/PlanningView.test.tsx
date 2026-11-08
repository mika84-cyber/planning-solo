import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { NoteListItem } from "./appModel";
import { MonthCalendar, MonthNavigation, NotesPanelContent } from "./PlanningView";

describe("vues du planning", () => {
  it("conserve une grille mensuelle complète", () => {
    const renderDay = vi.fn((date: Date) => <button type="button" key={date.toISOString()}>{date.getDate()}</button>);
    const html = renderToStaticMarkup(
      <MonthCalendar year={2026} month={7} renderDay={renderDay} />,
    );

    expect(renderDay).toHaveBeenCalledTimes(31);
    expect(html).toContain('class="weekdays"');
    expect(html).toContain('class="calendar-grid"');
  });

  it("répète le mois et ses flèches au-dessus des jours pendant une demande", () => {
    const html = renderToStaticMarkup(<MonthNavigation year={2026} month={9} onStep={vi.fn()} />);
    expect(html).toContain('<div class="month-card-nav"><button type="button" class="period-step" aria-label="Mois précédent">');
    expect(html).toContain('<p class="month-card-title" aria-live="polite"><strong>Octobre</strong> 2026</p>');
    expect(html).toContain('<button type="button" class="period-step" aria-label="Mois suivant">');
  });

  it("liste les notes à venir, sans barre de recherche, ou dit qu’il n’y en a pas", () => {
    const empty = renderToStaticMarkup(<NotesPanelContent upcoming={[]} renderItems={vi.fn()} />);
    expect(empty).toContain('<p class="upcoming-empty">Aucune note à venir.</p>');
    expect(empty).not.toContain("<input");

    const upcoming = [{ key: "note-2026-11-12", date: "2026-11-12", label: "Dentiste", detail: "", kind: "note", color: "#d65e68", author: "mika" }] as unknown as NoteListItem[];
    const renderItems = vi.fn(() => <ul className="note-month-list" />);
    const html = renderToStaticMarkup(<NotesPanelContent upcoming={upcoming} renderItems={renderItems} />);
    expect(html).toBe('<div class="request-archive-content"><ul class="note-month-list"></ul></div>');
    expect(renderItems).toHaveBeenCalledWith(upcoming);
  });
});
