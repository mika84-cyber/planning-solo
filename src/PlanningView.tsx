import type { ReactNode } from "react";
import type { NoteListItem } from "./appModel";
import { MONTH_OPTIONS, localDate, monthDays } from "./planningLogic";

const WEEKDAYS = [
  { key: "monday", compact: "L", full: "Lun" },
  { key: "tuesday", compact: "M", full: "Mar" },
  { key: "wednesday", compact: "M", full: "Mer" },
  { key: "thursday", compact: "J", full: "Jeu" },
  { key: "friday", compact: "V", full: "Ven" },
  { key: "saturday", compact: "S", full: "Sam" },
  { key: "sunday", compact: "D", full: "Dim" },
] as const;
const CALENDAR_CELL_KEYS = Array.from({ length: 42 }, (_, index) => `cell-${index + 1}`);

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
  /** `searching` : les résultats d'une recherche, à montrer dépliés. */
  renderItems: (items: NoteListItem[], searching?: boolean) => ReactNode;
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
          renderItems(searchResults, true)
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

/** Le mois affiché et ses deux flèches, posés juste au-dessus des jours
 *  pendant une demande : le panneau de la demande sépare alors la barre du
 *  mois de la grille, et l'on ne sait plus quel mois on touche ni comment en
 *  changer. `onStep` : −1 ou +1 mois. */
export function MonthNavigation({ year, month, onStep }: { year: number; month: number; onStep: (direction: -1 | 1) => void }) {
  const name = MONTH_OPTIONS[month].label;
  return (
    <div className="month-card-nav">
      <button type="button" className="period-step" aria-label="Mois précédent" onClick={() => onStep(-1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
      </button>
      <p className="month-card-title" aria-live="polite"><strong>{name.charAt(0).toLocaleUpperCase("fr") + name.slice(1)}</strong> {year}</p>
      <button type="button" className="period-step" aria-label="Mois suivant" onClick={() => onStep(1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
      </button>
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
  // Seulement les semaines du mois : pas de rangée vide en bas.
  const trailingDays = (7 - ((offset + days) % 7)) % 7;
  return (
    <>
      <div className={compact ? "mini-weekdays" : "weekdays"}>
        {WEEKDAYS.map((day) => (
          <span key={day.key}>
            {compact ? day.compact : day.full}
          </span>
        ))}
      </div>
      <div className={compact ? "mini-grid" : "calendar-grid"}>
        {CALENDAR_CELL_KEYS.slice(0, offset).map((key) => (
          <span
            className={compact ? "mini-blank" : "day-blank"}
            key={`leading-${key}`}
          />
        ))}
        {Array.from({ length: days }, (_, index) =>
          renderDay(localDate(year, month, index + 1), compact),
        )}
        {CALENDAR_CELL_KEYS.slice(42 - trailingDays).map((key) => (
          <span
            className={compact ? "mini-blank" : "day-blank"}
            key={`trailing-${key}`}
          />
        ))}
      </div>
    </>
  );
}
