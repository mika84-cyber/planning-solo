import type { CSSProperties } from "react";
import { splitNoteItemsIntoColumns } from "./noteColumns";
import type { Entries, NoteListItem } from "./appModel";
import { noteDateLabel } from "./appModel";
import { fromKey } from "./planningLogic";

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
};

/** Notes et rendez-vous à venir, répartis sur deux colonnes. */
export function UpcomingNoteList({
  items,
  entries,
  ownNoteAuthorLabel,
  onOpenDate,
  onDeleteOwnNotes,
  onDeleteAgnesNote,
}: UpcomingNoteListProps) {
  const [leftItems, rightItems] = splitNoteItemsIntoColumns(items);
  const renderItem = (item: NoteListItem) => {
    const hasOwnNote = item.author === "mika" || item.notes?.some((note) => note.author === "mika");
    const ownEntry = hasOwnNote ? entries[item.date] : undefined;
    const noteDates = ownEntry?.noteGroupId
      ? Object.entries(entries)
          .filter(([, entry]) => entry.noteGroupId === ownEntry.noteGroupId && Boolean(entry.noteText))
          .map(([date]) => date)
      : hasOwnNote ? [item.date] : [];
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
  return (
    <div className={`upcoming-list note-column-layout${rightItems.length ? "" : " single"}`}>
      <div className="upcoming-note-column">{leftItems.map(renderItem)}</div>
      {rightItems.length ? <div className="upcoming-note-column">{rightItems.map(renderItem)}</div> : null}
    </div>
  );
}
