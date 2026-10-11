import { adminStore, runPublications } from '../lib/adminTools.mts';
export default async () => { await runPublications(adminStore()); return new Response(null, { status: 204 }); };
// Toutes les cinq minutes : un document programmé sort au plus tard cinq
// minutes après son heure, sans réveiller la fonction 1 440 fois par jour.
export const config = { schedule: '*/5 * * * *' };
