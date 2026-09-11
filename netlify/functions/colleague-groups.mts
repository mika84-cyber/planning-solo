import { getUser } from "@netlify/identity";
import { adminStore, readGroups } from '../lib/adminTools.mts';
import { isTrustedMutation } from "../lib/requestSecurity.mts";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

export default async (request: Request) => {
  if (!isTrustedMutation(request))
    return new Response(JSON.stringify({ error: "Requête refusée." }), { status: 403, headers });
  const user = await getUser();
  if (!user?.id)
    return new Response(JSON.stringify({ error: "Authentification requise." }), { status: 401, headers });
  return new Response(JSON.stringify({ groups: await readGroups(adminStore()) }), { status: 200, headers });
};

export const config = { path: "/api/colleague-groups" };
