import { getUser } from "@netlify/identity";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import {
  forwardNotificationRequest,
  isMikaSharingAccount,
} from "../lib/sharedCalendarBridge.mts";
import { json } from "../lib/calendarShared.mts";

export default async function notifications(request: Request) {
  if (!isTrustedMutation(request))
    return json({ error: "Origine de la requête non autorisée" }, 403);
  const user = await getUser();
  if (!user?.email) return json({ error: "Connexion requise" }, 401);
  if (!(await isMikaSharingAccount(user.email)))
    return json({ error: "Compte non autorisé" }, 403);
  if (request.method !== "GET" && request.method !== "POST")
    return json({ error: "Méthode non autorisée" }, 405);
  const body = request.method === "POST"
    ? ((await request.json().catch(() => null)) as Record<string, unknown> | null)
    : undefined;
  if (request.method === "POST" && !body)
    return json({ error: "Requête invalide" }, 400);
  const response = await forwardNotificationRequest(request.method, body);
  return response || json({ error: "Notifications indisponibles" }, 503);
}

export const config = { path: "/api/notifications" };
