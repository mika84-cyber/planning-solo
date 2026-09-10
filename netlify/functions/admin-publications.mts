import { adminStore, runPublications } from '../lib/adminTools.mts';
export default async () => { await runPublications(adminStore()); return new Response(null, { status: 204 }); };
export const config = { schedule: '* * * * *' };
