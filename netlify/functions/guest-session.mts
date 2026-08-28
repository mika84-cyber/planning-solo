import { getUser } from "@netlify/identity";
import { sendGuestLoginAlertOnce } from "../lib/guestLoginAlert.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
    },
  });
}

export default async function guestSessionHandler(request: Request) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!isTrustedMutation(request))
    return json({ error: "Origine de la requête non autorisée" }, 403);
  const user = await getUser();
  if (!user?.id || !user.email) return json({ error: "Connexion requise" }, 401);

  try {
    const status = await sendGuestLoginAlertOnce(user.id, user.email);
    console.info("Planning Solo: session authentifiée traitée", status);
    return json({ ok: true, status });
  } catch (error) {
    console.warn(
      "Planning Solo: session autorisée mais alerte administrateur indisponible",
      error instanceof Error ? error.message : error,
    );
    return json({ ok: true, status: "unavailable" });
  }
}

export const config = { path: "/api/guest-session" };
