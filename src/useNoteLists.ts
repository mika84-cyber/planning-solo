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

type NoteListsInput = {
  entries: Entries;
  partnerEntries: PartnerCalendarEntries;
  partnerPeriods: PartnerLeavePeriod[];
  now: Date;
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

/**
 * Les notes du planning telles que l'accueil les liste : celles à venir, et
 * les congés d'Agnès marqués sur le calendrier (la recherche dans les notes
 * a été retirée le 8 novembre 2026).
 */
export function useNoteLists({ entries, partnerEntries, partnerPeriods, now, showNotes }: NoteListsInput) {
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

  return { agnesLeaveDates, upcoming };
}
