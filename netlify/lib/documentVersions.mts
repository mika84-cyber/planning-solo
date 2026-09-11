import { Buffer } from 'node:buffer';
import type { Store } from './adminTools.mts';

export type DocumentFileVersion = { contentBase64: string; contentType: string; filename: string; updatedAt: string };
export type DocumentRevision = { id: string; savedAt: string; file: DocumentFileVersion | null };
export const replacementKey = (id: string) => `useful-documents/replacements/${id}`;
export const revisionPrefix = (id: string) => `useful-documents/revisions/${id}/`;
export async function currentReplacement(store: Store, id: string) {
  return await store.get(replacementKey(id), { type: 'json' }) as DocumentFileVersion | null;
}
export async function saveDocumentVersion(store: Store, id: string, previous: DocumentFileVersion | null, next: DocumentFileVersion | null) {
  const revision: DocumentRevision = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), file: previous };
  await store.setJSON(`${revisionPrefix(id)}${revision.id}`, revision);
  // Le fichier et ses informations sont publiés ensemble, en une seule écriture.
  if (next) await store.setJSON(replacementKey(id), next);
  else await store.delete(replacementKey(id));
}
export function versionResponse(file: DocumentFileVersion) {
  return new Response(Buffer.from(file.contentBase64, 'base64'), { headers: {
    'content-type': file.contentType,
    'content-disposition': `inline; filename="${file.filename.replace(/["\\]/g, '')}"`,
    'cache-control': 'private, no-store',
  } });
}
