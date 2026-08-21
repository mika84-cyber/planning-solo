import type { ReactNode } from "react";
import type { NoteListItem } from "./appModel";
import { SHORT_DAYS, localDate, monthDays } from "./planningLogic";

export function NotesPanelContent({
  hasAnyNote,
  query,
  onQueryChange,
  searchResults,
  upcoming,
  renderItems,
}: {
  hasAnyNote: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  searchResults: NoteListItem[];
  upcoming: NoteListItem[];
  renderItems: (items: NoteListItem[]) => ReactNode;
}) {
  const normalizedQuery = query.trim();
  return (
    <div className="request-archive-content">
      {hasAnyNote && (
        <input
          type="search"
          className="note-search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Rechercher dans les notes…"
          aria-label="Rechercher dans les notes"
        />
      )}
      {normalizedQuery ? (
        searchResults.length ? (
          renderItems(searchResults)
        ) : (
          <p className="upcoming-empty">
            Aucune note ne correspond à « {normalizedQuery} ».
          </p>
        )
      ) : upcoming.length ? (
        renderItems(upcoming)
      ) : (
        <p className="upcoming-empty">Aucune note à venir.</p>
      )}
    </div>
  );
}

export function MonthCalendar({
  year,
  month,
  compact = false,
  renderDay,
}: {
  year: number;
  month: number;
  compact?: boolean;
  renderDay: (date: Date, compact: boolean) => ReactNode;
}) {
  const offset = (localDate(year, month, 1).getDay() + 6) % 7;
  const days = monthDays(year, month);
  const trailingDays = 42 - offset - days;
  return (
    <>
      <div className={compact ? "mini-weekdays" : "weekdays"}>
        {SHORT_DAYS.map((day, index) => (
          <span key={`${day}-${index}`}>
            {compact
              ? day
              : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][index]}
          </span>
        ))}
      </div>
      <div className={compact ? "mini-grid" : "calendar-grid"}>
        {Array.from({ length: offset }, (_, index) => (
          <span
            className={compact ? "mini-blank" : "day-blank"}
            key={`blank-${index}`}
          />
        ))}
        {Array.from({ length: days }, (_, index) =>
          renderDay(localDate(year, month, index + 1), compact),
        )}
        {Array.from({ length: trailingDays }, (_, index) => (
          <span
            className={compact ? "mini-blank" : "day-blank"}
            key={`trailing-blank-${index}`}
          />
        ))}
      </div>
    </>
  );
}
