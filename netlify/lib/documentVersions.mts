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
/** Un en-tête HTTP n'admet que des octets : le nom exact part encodé
 *  (filename*, RFC 6266), précédé d'un nom ASCII pour les anciens lecteurs. */
export function inlineContentDisposition(filename: string) {
  const fallback = filename
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  const encoded = encodeURIComponent(filename)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
export function versionResponse(file: DocumentFileVersion) {
  return new Response(Buffer.from(file.contentBase64, 'base64'), { headers: {
    'content-type': file.contentType,
    'content-disposition': inlineContentDisposition(file.filename),
    'cache-control': 'private, no-store',
  } });
}
