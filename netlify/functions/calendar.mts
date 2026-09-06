import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { migrateLegacyData, userDataKey } from "../lib/userScopedStore.mts";
import { readCalendarBody } from "../lib/calendarValidation.mts";
import { json } from "../lib/calendarShared.mts";
import { handleCalendarAction } from "../lib/calendar-actions/index.mts";
import { readCalendar } from "../lib/calendarRead.mts";
import {
  isMikaSharingAccount,
  mirrorSharedCalendarAction,
} from "../lib/sharedCalendarBridge.mts";

async function calendarHandler(request: Request): Promise<Response> {
  if (!isTrustedMutation(request))
    return json({ error: "Origine de la requête non autorisée" }, 403);
  const user = await getUser();
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
    const result = (await response.clone().json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const sharedStatus = await mirrorSharedCalendarAction(
      shareWithAgnes,
      body,
      result || undefined,
    );
    if (body.action === "delete-shared-partner-note" && sharedStatus !== "shared")
      return json({ error: "La note partagée n’a pas pu être supprimée" }, 502);
  }
  return response;
}

export default calendarHandler;
export const config = { path: "/api/calendar" };
