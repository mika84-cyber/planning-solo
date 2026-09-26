import { currentUser } from "../lib/identityUser.mts";
import { adminStore, readGenders, readGroups } from '../lib/adminTools.mts';
import { isTrustedMutation } from "../lib/requestSecurity.mts";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

export default async (request: Request) => {
  if (!isTrustedMutation(request))
    return new Response(JSON.stringify({ error: "Requête refusée." }), { status: 403, headers });
  const user = await currentUser();
  if (!user?.id)
    return new Response(JSON.stringify({ error: "Authentification requise." }), { status: 401, headers });
  const store = adminStore();
  const [groups, genders] = await Promise.all([readGroups(store), readGenders(store)]);
  return new Response(JSON.stringify({ groups, genders }), { status: 200, headers });
};

export const config = { path: "/api/colleague-groups" };
