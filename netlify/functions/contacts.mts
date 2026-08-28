import { getUser } from "@netlify/identity";
import { USEFUL_CONTACTS_DATA } from "../lib/usefulContactsData.mts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
    },
  });
}

async function contactsHandler(request: Request): Promise<Response> {
  if (request.method !== "GET")
    return json({ error: "Méthode non autorisée" }, 405);
  const user = await getUser();
  if (!user?.id || !user.email)
    return json({ error: "Connexion requise" }, 401);
  return json(USEFUL_CONTACTS_DATA);
}

export default contactsHandler;
export const config = { path: "/api/contacts" };
