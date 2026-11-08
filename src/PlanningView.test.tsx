import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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

  it("affiche le résultat vide d’une recherche de note", () => {
    const html = renderToStaticMarkup(
      <NotesPanelContent
        hasAnyNote
        query="réunion"
        onQueryChange={vi.fn()}
        searchResults={[]}
        upcoming={[]}
        renderItems={vi.fn()}
      />,
    );

    expect(html).toContain("Aucune note ne correspond à « réunion ».");
  });
});
