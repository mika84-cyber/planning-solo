import { getStore } from "@netlify/blobs";
import { currentUser } from "../lib/identityUser.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { migrateLegacyData, userDataKey } from "../lib/userScopedStore.mts";
import { readCalendarBody } from "../lib/calendarValidation.mts";
import { json, listBlobs } from "../lib/calendarShared.mts";
import { isCalendarTombstone } from "../lib/calendarAtomic.mts";
import { handleCalendarAction } from "../lib/calendar-actions/index.mts";
import { readCalendar } from "../lib/calendarRead.mts";
import {
  isMikaSharingAccount,
  mirrorMikaNoteChanges,
  mirrorSharedCalendarAction,
} from "../lib/sharedCalendarBridge.mts";
import {
  diffNotes,
  noteTargets,
  notifyNoteChanges,
  readNoteSnapshot,
  touchesNotes,
} from "../lib/noteChangeNotifications.mts";

async function calendarHandler(request: Request): Promise<Response> {
  if (!isTrustedMutation(request))
    return json({ error: "Origine de la requête non autorisée" }, 403);
  const user = await currentUser();
  if (!user?.id || !user.email)
    return json({ error: "Connexion requise" }, 401);
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  const shareWithAgnes = await isMikaSharingAccount(user.email);
  await migrateLegacyData(store, user.id);
  const scopedKey = (key: string) => userDataKey(user.id, key);
  const entryPrefix = scopedKey("entry/");
  const periodPrefix = scopedKey("period/");
  const overtimePrefix = scopedKey("overtime/");
  const recoveryUsePrefix = scopedKey("recovery-use/");
  const mecenatPrefix = scopedKey("mecenat/");
  if (request.method === "GET")
    return readCalendar({
      email: user.email,
      store,
      scopedKey,
      entryPrefix,
      periodPrefix,
      overtimePrefix,
      recoveryUsePrefix,
      mecenatPrefix,
      shareWithAgnes,
    });
  if (request.method !== "POST")
    return json({ error: "Méthode non autorisée" }, 405);
  const parsed = await readCalendarBody(request);
  if ("error" in parsed)
    return json(
      { error: parsed.error },
      parsed.error === "Requête trop volumineuse" ? 413 : 400,
    );
  const body = parsed.body;
  if (body.action === "delete-shared-partner-note" && !shareWithAgnes)
    return json({ error: "Partage privé indisponible" }, 403);
  // Les notes avant l'écriture, pour dire ensuite ce qui a changé.
  const followNotes = shareWithAgnes && touchesNotes(body);
  const targets = followNotes ? noteTargets(body) : null;
  const notesBefore = targets
    ? await readNoteSnapshot(store, scopedKey, entryPrefix, targets)
    : null;
  const response = await handleCalendarAction({
    body,
    request,
    user: { id: user.id, email: user.email },
    store,
    scopedKey,
    entryPrefix,
    periodPrefix,
    overtimePrefix,
    recoveryUsePrefix,
    mecenatPrefix,
    calendarHandler,
  });
  if (response.ok && shareWithAgnes) {
    // Les congés de Mika, relus après l'écriture, pour le planning d'Agnès.
    const readPeriods = async () => {
      const listed = await listBlobs(store, periodPrefix);
      const periods = await Promise.all(listed.blobs.map((blob) => store.get(blob.key, { type: "json" })));
      return periods.filter((period): period is Record<string, unknown> =>
        Boolean(period) && typeof period === "object" && !isCalendarTombstone(period));
    };
    const sharedStatus = await mirrorSharedCalendarAction(
      shareWithAgnes,
      body,
      readPeriods,
    );
    if (body.action === "delete-shared-partner-note" && sharedStatus !== "shared")
      return json({ error: "La note partagée n’a pas pu être supprimée" }, 502);
  }
  if (response.ok && targets && notesBefore) {
    const notesAfter = await readNoteSnapshot(store, scopedKey, entryPrefix, targets);
    const changes = diffNotes(notesBefore, notesAfter);
    // La note d'abord sur le planning d'Agnès, puis le message qui l'annonce.
    await mirrorMikaNoteChanges(changes);
    await notifyNoteChanges(changes);
  }
  return response;
}

export default calendarHandler;
export const config = { path: "/api/calendar" };
