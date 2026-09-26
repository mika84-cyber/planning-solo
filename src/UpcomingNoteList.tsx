import type { CSSProperties } from "react";
import type { Entries, NoteListItem } from "./appModel";
import { noteDateLabel } from "./appModel";
import { fromKey } from "./planningLogic";

const weekdayFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const monthTitleFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/** Les lignes d'une note, débarrassées de leurs puces, avec une clé stable
 *  même lorsque deux lignes portent le même texte. */
function keyedNoteLines(value: string) {
  const occurrences = new Map<string, number>();
  return value
    .split("\n")
    .map((line) => line.replace(/^[–—\-•>]\s*/, "").trim())
    .filter(Boolean)
    .map((label) => {
      const occurrence = (occurrences.get(label) ?? 0) + 1;
      occurrences.set(label, occurrence);
      return { key: `${label}-${occurrence}`, label };
    });
}

export type UpcomingNoteListProps = {
  items: NoteListItem[];
  entries: Entries;
  ownNoteAuthorLabel: string;
  onOpenDate: (date: Date) => void;
  onDeleteOwnNotes: (dates: string[]) => void;
  onDeleteAgnesNote: (date: string) => void;
  /** Pendant une recherche, les mois s'ouvrent pour montrer les résultats. */
  monthsOpen?: boolean;
};

/** Notes et rendez-vous à venir, rangés par mois dans des volets repliés
 *  par défaut. */
export function UpcomingNoteList({
  items,
  entries,
  ownNoteAuthorLabel,
  onOpenDate,
  onDeleteOwnNotes,
  onDeleteAgnesNote,
  monthsOpen = false,
}: UpcomingNoteListProps) {
  const renderItem = (item: NoteListItem) => {
    const hasOwnNote = item.author === "mika" || item.notes?.some((note) => note.author === "mika");
    const ownEntry = hasOwnNote ? entries[item.date] : undefined;
    const noteDates = ownEntry?.noteGroupId
      ? Object.entries(entries)
          .filter(([, entry]) => entry.noteGroupId === ownEntry.noteGroupId && Boolean(entry.noteText))
          .map(([date]) => date)
      : hasOwnNote ? [item.date] : [];
    // Une carte par jour : la date en petit calendrier à gauche, puis chaque
    // note sur sa ligne, son auteur à sa couleur et une croix discrète.
    if (item.kind === "note" && item.notes) {
      const date = fromKey(item.date);
      const showYear = date.getFullYear() !== new Date().getFullYear();
      return (
        <article className="upcoming-item note note-card" key={item.key}>
          <button
            type="button"
            className="note-card-date"
            aria-label={`Ouvrir le ${noteDateLabel(item.date)}`}
            onClick={() => onOpenDate(date)}
          >
            <small>{weekdayFormatter.format(date).replace(".", "")}</small>
            <b>{date.getDate()}</b>
            <small>{monthFormatter.format(date).replace(".", "")}{showYear ? ` ${date.getFullYear()}` : ""}</small>
          </button>
          <div className="note-card-parts">
            {item.notes.map((note) => {
              const author = note.author === "mika" ? ownNoteAuthorLabel : "Agnès";
              const deletable = note.author !== "mika" || noteDates.length > 0;
              return (
                <div className={`note-card-part note-author-${note.author}`} key={`${item.key}-${note.author}`}>
                  <button type="button" className="note-card-open" onClick={() => onOpenDate(date)}>
                    <b>{author}</b>
                    <strong>{note.label}</strong>
                  </button>
                  {deletable ? (
                    <button
                      className="note-delete-button"
                      type="button"
                      aria-label={`Supprimer ${note.author === "mika" ? `la note de ${ownNoteAuthorLabel}` : "la note d’Agnès"} du ${noteDateLabel(item.date)}`}
                      title={`Supprimer ${note.author === "mika" ? `la note de ${ownNoteAuthorLabel}` : "la note d’Agnès"}`}
                      onClick={() => note.author === "mika"
                        ? onDeleteOwnNotes(noteDates)
                        : onDeleteAgnesNote(item.date)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>
      );
    }
    return (
    <article
      className={`upcoming-item ${item.kind}`}
      key={item.key}
      style={
        item.color
          ? ({ "--item-color": item.color } as CSSProperties)
          : undefined
      }
    >
      <button
        type="button"
        className="upcoming-item-open"
        onClick={() => onOpenDate(fromKey(item.date))}
      >
        {!item.notes ? <i /> : null}
        <span>
        {item.kind === "note" ? (
          <small className="note-date-badge">{noteDateLabel(item.date)}</small>
        ) : null}
        {item.notes ? (
          <span className="shared-note-stack">
            {item.notes.map((note) => (
              <span
                className={`shared-note-part note-author-${note.author}`}
                key={`${item.key}-${note.author}`}
              >
                <b>{note.author === "mika" ? ownNoteAuthorLabel : "Agnès"}</b>
                <strong>{note.label}</strong>
              </span>
            ))}
          </span>
        ) : item.label.includes("\n") ? (
          <ul className="note-bullets">
            {keyedNoteLines(item.label).map(({ key, label }) => (
              <li key={`${item.key}-${key}`}>{label}</li>
            ))}
          </ul>
        ) : (
          <strong>{item.label}</strong>
        )}
        {item.kind !== "note" ? <small>{item.detail}</small> : null}
        </span>
      </button>
      {item.notes?.map((note, index) => {
        if (note.author === "mika" && !noteDates.length) return null;
        return (
          <button
            key={`${item.key}-delete-${note.author}`}
            className="note-delete-button"
            type="button"
            aria-label={`Supprimer ${note.author === "mika" ? `la note de ${ownNoteAuthorLabel}` : "la note d’Agnès"} du ${noteDateLabel(item.date)}`}
            title={`Supprimer ${note.author === "mika" ? `la note de ${ownNoteAuthorLabel}` : "la note d’Agnès"}`}
            style={item.notes!.length > 1 ? { top: index === 0 ? "33%" : "67%" } : undefined}
            onClick={() => note.author === "mika"
              ? onDeleteOwnNotes(noteDates)
              : onDeleteAgnesNote(item.date)}
          >
            ×
          </button>
        );
      })}
    </article>
    );
  };
  // Un volet par mois, dans l'ordre du calendrier ; le compte distingue les
  // notes de Mika et d'Agnès d'un même jour.
  const months = new Map<string, { label: string; count: number; items: NoteListItem[] }>();
  for (const item of items) {
    const key = item.date.slice(0, 7);
    let month = months.get(key);
    if (!month) {
      const label = monthTitleFormatter.format(fromKey(item.date));
      month = { label: label.charAt(0).toUpperCase() + label.slice(1), count: 0, items: [] };
      months.set(key, month);
    }
    month.items.push(item);
    month.count += Math.max(1, item.notes?.length ?? 0);
  }
  return (
    <div className="upcoming-list note-month-list">
      {[...months.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([key, month]) => (
        <details className="note-month" key={`${monthsOpen ? "recherche" : "liste"}-${key}`} open={monthsOpen}>
          <summary>
            <span><strong>{month.label}</strong><small>{month.count} note{month.count > 1 ? "s" : ""}</small></span>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="upcoming-note-column">{month.items.map(renderItem)}</div>
        </details>
      ))}
    </div>
  );
}
