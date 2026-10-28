import { useMemo } from "react";
import {
  groupNoteItemsByDate,
  notePeriodFor,
  rangeKeys,
  type Entries,
  type NoteListItem,
  type PartnerCalendarEntries,
  type PartnerLeavePeriod,
} from "./appModel";
import { dateKey, periodLabel } from "./planningLogic";
import { matchesSearch } from "./searchMatching";

type NoteListsInput = {
  entries: Entries;
  partnerEntries: PartnerCalendarEntries;
  partnerPeriods: PartnerLeavePeriod[];
  now: Date;
  /** La recherche en cours dans les notes. */
  noteQuery: string;
  showNotes: boolean;
};

/** Les notes à venir, de Mika et d'Agnès, une ligne par jour : une note
 *  posée sur plusieurs jours a chacun de ses jours dans la liste, comme sur
 *  le calendrier, avec sa période en détail. Toutes les notes à venir, même
 *  au-delà d'un an. */
export function upcomingNoteItems(entries: Entries, partnerEntries: PartnerCalendarEntries, todayKey: string, showNotes: boolean) {
  const items: NoteListItem[] = [];
  if (showNotes) {
    for (const [key, entry] of Object.entries(entries)) {
      if (key < todayKey || !entry.noteText) continue;
      const notePeriod = notePeriodFor(entries, key, entry);
      items.push({
        // Une clé par jour : deux lignes ne partagent jamais la même.
        key: `note-${key}`,
        date: key,
        label: entry.noteText,
        detail: periodLabel(notePeriod.from, notePeriod.to),
        kind: "note",
        color: "#d65e68",
        author: "mika",
      });
    }
    for (const [key, entry] of Object.entries(partnerEntries)) {
      if (key < todayKey || entry.noteAuthor !== "agnes" || !entry.noteText) continue;
      items.push({
        key: `agnes-note-${key}`,
        date: key,
        label: entry.noteText,
        detail: periodLabel(key, key),
        kind: "note",
        color: "#f2c84b",
        author: "agnes",
      });
    }
  }
  return groupNoteItemsByDate(items.sort(
    (a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind),
  ));
}

/** Les notes qui répondent à une recherche, passées comme à venir, une
 *  ligne par jour là aussi. */
export function noteSearchItems(entries: Entries, partnerEntries: PartnerCalendarEntries, noteQuery: string) {
  const query = noteQuery.trim();
  if (!query) return [];
  const items: NoteListItem[] = [];
  for (const [key, entry] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    if (!entry.noteText || !matchesSearch(entry.noteText, query)) continue;
    const notePeriod = notePeriodFor(entries, key, entry);
    items.push({
      key: `search-${key}`,
      date: key,
      label: entry.noteText,
      detail: periodLabel(notePeriod.from, notePeriod.to),
      kind: "note",
      color: "#d65e68",
      author: "mika",
    });
  }
  for (const [key, entry] of Object.entries(partnerEntries).sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.noteAuthor !== "agnes" || !matchesSearch(entry.noteText, query)) continue;
    items.push({
      key: `search-agnes-${key}`,
      date: key,
      label: entry.noteText,
      detail: periodLabel(key, key),
      kind: "note",
      color: "#f2c84b",
      author: "agnes",
    });
  }
  return groupNoteItemsByDate(items);
}

/**
 * Les notes du planning telles que l'accueil les liste : celles à venir, le
 * résultat d'une recherche, et les congés d'Agnès marqués sur le calendrier.
 */
export function useNoteLists({ entries, partnerEntries, partnerPeriods, now, noteQuery, showNotes }: NoteListsInput) {
  const agnesLeaveDates = useMemo(() => {
    const dates = new Set(
      Object.entries(partnerEntries)
        .filter(([, entry]) => entry.agnesLeave)
        .map(([date]) => date),
    );
    for (const period of partnerPeriods)
      for (const date of rangeKeys(period.from, period.to)) dates.add(date);
    return dates;
  }, [partnerEntries, partnerPeriods]);

  const upcoming = useMemo(
    () => upcomingNoteItems(entries, partnerEntries, dateKey(now), showNotes),
    [entries, now, partnerEntries, showNotes],
  );

  const hasAnyNote = useMemo(
    () =>
      Object.values(entries).some((entry) => entry.noteText) ||
      Object.values(partnerEntries).some(
        (entry) => entry.noteAuthor === "agnes" && entry.noteText,
      ),
    [entries, partnerEntries],
  );

  /** Recherche sur toutes les notes enregistrées, passées comme à venir. */
  const noteSearchResults = useMemo(
    () => noteSearchItems(entries, partnerEntries, noteQuery),
    [entries, noteQuery, partnerEntries],
  );

  return { agnesLeaveDates, upcoming, hasAnyNote, noteSearchResults };
}
