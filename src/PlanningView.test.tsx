import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MonthCalendar, NotesPanelContent } from "./PlanningView";

describe("vues du planning", () => {
  it("conserve une grille mensuelle complète", () => {
    const renderDay = vi.fn((date: Date) => <button key={date.toISOString()}>{date.getDate()}</button>);
    const html = renderToStaticMarkup(
      <MonthCalendar year={2026} month={7} renderDay={renderDay} />,
    );

    expect(renderDay).toHaveBeenCalledTimes(31);
    expect(html).toContain('class="weekdays"');
    expect(html).toContain('class="calendar-grid"');
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
