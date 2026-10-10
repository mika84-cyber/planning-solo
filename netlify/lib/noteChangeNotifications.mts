import { dateKeys, listBlobs, type CalendarEntry } from "./calendarShared.mts";
import { sendSharedPlanningNotification } from "./sharedCalendarBridge.mts";

/* Les notes de Mika avant et après une écriture du calendrier : on compare
   les deux états pour dire précisément ce qui a changé (ajout, modification,
   suppression), avec la date et le texte. Seules les actions qui touchent
   une note sont suivies ; le reste du calendrier ne déclenche rien. */

type Store = Parameters<typeof listBlobs>[0];
export type NoteSnapshot = Record<string, { text: string; groupId: string }>;
export type NoteChange = {
  kind: "added" | "updated" | "deleted";
  from: string;
  to: string;
  text: string;
  previousText: string;
};

const NOTE_ACTIONS = new Set(["save-entry", "save-note-period", "delete-note-period"]);
const validDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function noteOperations(body: Record<string, unknown>) {
  const operations = body.action === "batch" && Array.isArray(body.operations)
    ? body.operations as Record<string, unknown>[]
    : [body];
  return operations.filter((operation) =>
    operation && typeof operation === "object" && NOTE_ACTIONS.has(String(operation.action)),
  );
}

/** Une écriture touche-t-elle une note ? Sinon, rien à lire ni à envoyer. */
export function touchesNotes(body: Record<string, unknown>) {
  return noteOperations(body).length > 0;
}

/** Les dates à relire, et les groupes de notes dont toutes les dates comptent
 *  (une note sur plusieurs jours se modifie ou s'efface d'un bloc). */
export function noteTargets(body: Record<string, unknown>) {
  const dates = new Set<string>();
  const groups = new Set<string>();
  for (const operation of noteOperations(body)) {
    if (validDate(operation.date)) dates.add(operation.date);
    if (validDate(operation.from) && validDate(operation.to) && operation.from <= operation.to)
      for (const date of dateKeys(operation.from, operation.to).slice(0, 400)) dates.add(date);
    for (const groupId of [operation.groupId, operation.noteGroupId])
      if (typeof groupId === "string" && groupId) groups.add(groupId);
  }
  return { dates: [...dates], groups: [...groups] };
}

export async function readNoteSnapshot(
  store: Store,
  scopedKey: (key: string) => string,
  entryPrefix: string,
  targets: { dates: string[]; groups: string[] },
): Promise<NoteSnapshot> {
  const snapshot: NoteSnapshot = {};
  const keep = (entry: CalendarEntry | null) => {
    if (entry?.date && entry.note_text)
      snapshot[entry.date] = { text: entry.note_text, groupId: entry.note_group_id || "" };
  };
  if (targets.groups.length) {
    const listed = await listBlobs(store, entryPrefix);
    await Promise.all(listed.blobs.map(async (blob) => {
      const entry = (await store.get(blob.key, { type: "json" })) as CalendarEntry | null;
      if (entry?.note_group_id && targets.groups.includes(entry.note_group_id)) keep(entry);
    }));
  }
  await Promise.all(targets.dates.map(async (date) => {
    keep((await store.get(scopedKey(`entry/${date}`), { type: "json" })) as CalendarEntry | null);
  }));
  return snapshot;
}

const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** Compare les deux états, date par date, puis réunit les jours qui se
 *  suivent avec le même changement : une note sur trois jours donne un seul
 *  message « du … au … ». */
export function diffNotes(before: NoteSnapshot, after: NoteSnapshot): NoteChange[] {
  const dates = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes: NoteChange[] = [];
  for (const date of dates) {
    const previousText = before[date]?.text || "";
    const text = after[date]?.text || "";
    if (previousText === text) continue;
    const kind = !previousText ? "added" : !text ? "deleted" : "updated";
    const last = changes.at(-1);
    if (last && last.kind === kind && last.text === text && last.previousText === previousText && nextDay(last.to) === date) {
      last.to = date;
      continue;
    }
    changes.push({ kind, from: date, to: date, text, previousText });
  }
  return changes;
}

const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const at = (date: string) => new Date(`${date}T12:00:00Z`);

export function noteDates(from: string, to: string) {
  if (from === to) return `le ${DAY.format(at(from))}`;
  return `du ${SHORT.format(at(from))} au ${SHORT.format(at(to))}`;
}

/** Le titre dit qui a fait quoi ; le corps, la date et le texte (et l'ancien
 *  texte pour une modification). */
export function describeNoteChange(change: NoteChange, author = "Mika") {
  const verb = change.kind === "added" ? "ajouté" : change.kind === "updated" ? "modifié" : "annulé";
  const when = noteDates(change.from, change.to);
  const body = change.kind === "added"
    ? `${when} : ${change.text}`
    : change.kind === "updated"
      ? `${when} : ${change.text} (avant : ${change.previousText})`
      : `${when} : ${change.previousText}`;
  return {
    title: `${author} a ${verb} une note`,
    body: body.charAt(0).toUpperCase() + body.slice(1),
    // Agnès ouvre son propre planning, au jour de la note.
    url: `/?date=${change.from}`,
    tag: `note-${change.from}`,
  };
}

/** Envoie un message par changement, à Agnès seule ; un envoi raté
 *  n'empêche jamais l'enregistrement, déjà fait. */
export async function notifyNoteChanges(changes: NoteChange[], send = sendSharedPlanningNotification) {
  for (const change of changes.slice(0, 5)) {
    try {
      await send({ ...describeNoteChange(change), recipients: ["agnes"] });
    } catch (error) {
      console.error("Notification de note impossible", error);
    }
  }
}
