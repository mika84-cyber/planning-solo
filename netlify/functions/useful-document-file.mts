import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getUser } from '@netlify/identity';
import { adminStore } from '../lib/adminTools.mts';
import { currentReplacement, versionResponse } from '../lib/documentVersions.mts';

// Les liens d'origine continuent à servir la version actuelle.
export default async function handler(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('file') || url.pathname.split('/').pop()!;
  if (!originalPaths.includes(`/useful-forms/${id}`)) return new Response('Document introuvable.', { status: 404 });
  const store = adminStore();
  const edit = await store.get(`useful-documents/catalog/${id}`, { type: 'json' }) as { deleted?: boolean } | null;
  if (edit?.deleted) return new Response('Document introuvable.', { status: 404, headers: { 'cache-control': 'no-store' } });
  const file = await currentReplacement(store, id);
  if (!file) {
    const original = await readFile(resolve('public/useful-forms', id));
    return new Response(new Uint8Array(original), { headers: {
      'content-type': id.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
      'content-disposition': `inline; filename="${id}"`,
      'cache-control': 'public, max-age=0, must-revalidate',
    } });
  }
  if (!(await getUser())?.id) return new Response('Connexion requise.', { status: 401, headers: { 'cache-control': 'no-store' } });
  return versionResponse(file);
}

const originalPaths = [
  '/useful-forms/hilma-af-klint.pdf', '/useful-forms/demande-conges.pdf',
  '/useful-forms/demande-recuperations.pdf', '/useful-forms/demande-annulation-conges.pdf',
  '/useful-forms/formulaire-changement-coordonnees.pdf', '/useful-forms/changement-coordonnees-bancaires.docx',
  '/useful-forms/demande-carte-restauration-bimpli.pdf', '/useful-forms/procuration-retrait-titres-repas.pdf',
  '/useful-forms/demande-carte-culture-a.pdf', '/useful-forms/cet-demande-ouverture.pdf',
  '/useful-forms/cet-alimentation-indemnisation.pdf',
];
export const config = { path: '/api/useful-document-file' };
