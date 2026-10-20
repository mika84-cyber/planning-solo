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
import { addDays, dateKey, fromKey, periodLabel } from "./planningLogic";
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

  const upcoming = useMemo(() => {
    const todayKey = dateKey(now);
    // Toutes les notes à venir, même au-delà d'un an : le calendrier les
    // montre, la liste aussi.
    const datedEntries = Object.entries(entries).filter(([key]) => key >= todayKey);
    const items: NoteListItem[] = [];
    /** Une note posée sur plusieurs jours d'affilée n'apparaît qu'une fois, à
     *  son premier jour à venir. Chaque autre date du planning qui porte une
     *  note a sa ligne : la liste montre les mêmes notes que le calendrier,
     *  quel que soit l'ordre dans lequel le serveur les renvoie. Deux notes
     *  d'un jour chacune restent deux notes, même au texte identique : seul
     *  un même groupe (une note sur plusieurs jours) se réunit. */
    const continuesPreviousDay = (source: Record<string, { noteText: string; noteGroupId: string }>, key: string) => {
      const previous = source[dateKey(addDays(fromKey(key), -1))];
      return key > todayKey && Boolean(source[key].noteGroupId) && previous?.noteText === source[key].noteText && previous.noteGroupId === source[key].noteGroupId;
    };
    if (showNotes) {
      for (const [key, entry] of datedEntries) {
        if (!entry.noteText || continuesPreviousDay(entries, key)) continue;
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
        if (
          key < todayKey ||
          entry.noteAuthor !== "agnes" ||
          !entry.noteText ||
          continuesPreviousDay(partnerEntries, key)
        ) continue;
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
    return groupNoteItemsByDate(items
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind),
      )
    );
  }, [entries, now, partnerEntries, showNotes]);

  const hasAnyNote = useMemo(
    () =>
      Object.values(entries).some((entry) => entry.noteText) ||
      Object.values(partnerEntries).some(
        (entry) => entry.noteAuthor === "agnes" && entry.noteText,
      ),
    [entries, partnerEntries],
  );

  /** Recherche sur toutes les notes enregistrées, passées comme à venir
      (contrairement à `upcoming`, borné aux 365 prochains jours). */
  const noteSearchResults = useMemo(() => {
    const query = noteQuery.trim();
    if (!query) return [];
    const items: NoteListItem[] = [];
    const seenGroups = new Set<string>();
    for (const [key, entry] of Object.entries(entries).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!entry.noteText || !matchesSearch(entry.noteText, query))
        continue;
      if (entry.noteGroupId) {
        if (seenGroups.has(entry.noteGroupId)) continue;
        seenGroups.add(entry.noteGroupId);
      }
      const notePeriod = notePeriodFor(entries, key, entry);
      items.push({
        key: `search-${entry.noteGroupId || key}`,
        date: key,
        label: entry.noteText,
        detail: periodLabel(notePeriod.from, notePeriod.to),
        kind: "note",
        color: "#d65e68",
        author: "mika",
      });
    }
    const seenPartnerGroups = new Set<string>();
    for (const [key, entry] of Object.entries(partnerEntries).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (
        entry.noteAuthor !== "agnes" ||
        !matchesSearch(entry.noteText, query) ||
        (entry.noteGroupId && seenPartnerGroups.has(entry.noteGroupId))
      ) continue;
      if (entry.noteGroupId) seenPartnerGroups.add(entry.noteGroupId);
      items.push({
        key: `search-agnes-${entry.noteGroupId || key}`,
        date: key,
        label: entry.noteText,
        detail: periodLabel(key, key),
        kind: "note",
        color: "#f2c84b",
        author: "agnes",
      });
    }
    return groupNoteItemsByDate(items);
  }, [entries, noteQuery, partnerEntries]);

  return { agnesLeaveDates, upcoming, hasAnyNote, noteSearchResults };
}
