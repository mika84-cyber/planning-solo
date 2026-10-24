import { getStore } from "@netlify/blobs";
import { currentUser, accountDisplayName } from "../lib/identityUser.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { migrateLegacyData, userDataKey } from "../lib/userScopedStore.mts";
import { readCalendarBody } from "../lib/calendarValidation.mts";
import { json, listBlobs } from "../lib/calendarShared.mts";
import { isCalendarTombstone } from "../lib/calendarAtomic.mts";
import { handleCalendarAction } from "../lib/calendar-actions/index.mts";
import { readCalendar } from "../lib/calendarRead.mts";
import {
  isMikaSharingAccount,
  mirrorSharedCalendarAction,
  noteChangeOperations,
  sharedActionOperations,
} from "../lib/sharedCalendarBridge.mts";
import { deliverSharedOperations } from "../lib/sharedBridgeQueue.mts";
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
  const mecenatSignupPrefix = scopedKey("mecenat-signup/");
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
      mecenatSignupPrefix,
      shareWithAgnes,
      accountName: accountDisplayName(user),
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
  const actionContext = {
    request,
    user: { id: user.id, email: user.email },
    store,
    scopedKey,
    entryPrefix,
    periodPrefix,
    overtimePrefix,
    recoveryUsePrefix,
    mecenatPrefix,
  };
  // Une opération d'un lot s'exécute seule : ni nouvelle authentification,
  // ni recopie vers le planning d'Agnès. Le lot recopie une seule fois, plus
  // bas, et seulement s'il a réussi en entier — un lot annulé ne laisse donc
  // rien chez Agnès.
  const runOperation = async (operationRequest: Request): Promise<Response> => {
    const operation = await readCalendarBody(operationRequest);
    if ("error" in operation) return json({ error: operation.error }, 400);
    return handleCalendarAction({ ...actionContext, body: operation.body, request: operationRequest, runOperation });
  };
  const response = await handleCalendarAction({ ...actionContext, body, runOperation });
  if (response.ok && shareWithAgnes) {
    // Les congés de Mika, relus après l'écriture, pour le planning d'Agnès.
    const readPeriods = async () => {
      const listed = await listBlobs(store, periodPrefix);
      const periods = await Promise.all(listed.blobs.map((blob) => store.get(blob.key, { type: "json" })));
      return periods.filter((period): period is Record<string, unknown> =>
        Boolean(period) && typeof period === "object" && !isCalendarTombstone(period));
    };
    // Supprimer une note d'Agnès ne peut pas attendre : sans réponse de son
    // planning, Mika le sait tout de suite.
    if (body.action === "delete-shared-partner-note") {
      const sharedStatus = await mirrorSharedCalendarAction(shareWithAgnes, body, readPeriods);
      if (sharedStatus !== "shared")
        return json({ error: "La note partagée n’a pas pu être supprimée" }, 502);
      return response;
    }
    // L'écriture de Mika est faite : la copie ne doit jamais la faire échouer.
    try {
      const changes = targets && notesBefore
        ? diffNotes(notesBefore, await readNoteSnapshot(store, scopedKey, entryPrefix, targets))
        : [];
      // Une copie qui n'aboutit pas attend la prochaine écriture ou ouverture.
      const delivered = await deliverSharedOperations(store, scopedKey, [
        ...(await sharedActionOperations(body, readPeriods)),
        ...noteChangeOperations(changes),
      ]);
      // La note d'abord sur le planning d'Agnès, puis le message qui l'annonce.
      if (delivered === "shared") await notifyNoteChanges(changes);
    } catch (error) {
      console.error("Copie vers le planning d’Agnès impossible", error instanceof Error ? error.message : error);
    }
  }
  return response;
}

export default calendarHandler;
export const config = { path: "/api/calendar" };
