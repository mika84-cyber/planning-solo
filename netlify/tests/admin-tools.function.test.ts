import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const data = new Map<string, unknown>();
const versions = new Map<string, number>();
const store = {
  get: vi.fn(async (key: string) => structuredClone(data.get(key) ?? null)),
  getWithMetadata: vi.fn(async (key: string) => data.has(key) ? { data: structuredClone(data.get(key)), etag: String(versions.get(key)) } : null),
  setJSON: vi.fn(async (key: string, value: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) => {
    if ((options?.onlyIfNew && data.has(key)) || (options?.onlyIfMatch && options.onlyIfMatch !== String(versions.get(key)))) return { modified: false };
    data.set(key, structuredClone(value)); versions.set(key, (versions.get(key) || 0) + 1); return { modified: true };
  }),
  delete: vi.fn(async (key: string) => { data.delete(key); }),
  list: vi.fn(({ prefix }: { prefix: string }) => ({ async *[Symbol.asyncIterator]() { yield { blobs: [...data.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; } })),
};
vi.mock('@netlify/blobs', () => ({ getStore: vi.fn(() => store) }));
vi.mock('@netlify/identity', () => ({ getUser: vi.fn(), admin: { listUsers: vi.fn() } }));
vi.mock('../lib/documentAnnouncementEmail.mts', () => ({ sendDocumentAnnouncementEmail: vi.fn(async () => true) }));
import { getUser, admin } from '@netlify/identity';
import handler from '../functions/admin-tools.mts';
import documents from '../functions/useful-documents.mts';
import contacts from '../functions/contacts.mts';
import groupsHandler from '../functions/colleague-groups.mts';
import { runPublications, adminStore } from '../lib/adminTools.mts';
import { sendDocumentAnnouncementEmail } from '../lib/documentAnnouncementEmail.mts';
const post = (payload: unknown, path = 'admin-tools') => new Request(`https://example.test/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
const get = (path = 'admin-tools') => new Request(`https://example.test/api/${path}`);
const owner = () => vi.mocked(getUser).mockResolvedValue({ id: 'owner', email: 'admin@example.test' } as never);
const guest = (id = 'guest-1') => vi.mocked(getUser).mockResolvedValue({ id, email: `${id}@example.test` } as never);
const upload = (extra = {}) => ({ action: 'add-document', title: 'Future exposition', folder: 'expo', filename: 'fiche.pdf', contentBase64: Buffer.from('%PDF-1.7\ntest').toString('base64'), notifyGuests: true, ...extra });
const overview = async () => (await handler(get())).json();
describe('outils administrateur', () => {
  beforeEach(() => {
    data.clear(); versions.clear(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-09T10:00:00Z'));
    vi.stubGlobal('Netlify', { env: { get: (key: string) => key === 'PROGRAM_ADMIN_EMAIL' ? 'admin@example.test' : undefined } });
    owner(); vi.mocked(admin.listUsers).mockResolvedValue([{ id: 'guest-1', email: 'one@example.test' }, { id: 'guest-2', email: 'two@example.test' }] as never);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('ne révèle aux invités que le message actif et refuse toutes leurs écritures', async () => {
    guest();
    expect(await (await handler(get())).json()).toEqual({ pin: null });
    for (const action of ['pin', 'move-member', 'remove-member', 'restore', 'cancel-job']) expect((await handler(post({ action }))).status).toBe(403);
    vi.mocked(getUser).mockResolvedValue(null);
    expect((await handler(get())).status).toBe(401);
    owner();
    expect((await handler(new Request('https://example.test/api/admin-tools', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' }))).status).toBe(403);
  });
  it('publie un message qui expire et permet de le retirer', async () => {
    expect((await handler(post({ action: 'pin', message: 'Information temporaire', until: '2026-09-09T11:00:00Z' }))).status).toBe(200);
    guest(); expect((await overview()).pin.message).toBe('Information temporaire');
    vi.setSystemTime(new Date('2026-09-09T11:01:00Z')); expect((await overview()).pin).toBeNull();
    owner(); expect((await handler(post({ action: 'pin', message: '' }))).status).toBe(200);
  });
  it('déplace sans doublon et fournit les groupes mis à jour aux invités', async () => {
    const before = (await overview()).groups;
    const member = before[0].members[0];
    expect((await handler(post({ action: 'move-member', member, group: 2 }))).status).toBe(200);
    guest(); const after = await (await groupsHandler(get('colleague-groups'))).json();
    expect(after.groups[0].members).not.toContain(member); expect(after.groups[1].members).toContain(member);
    expect(after.groups.flatMap((group: { members: string[] }) => group.members).filter((name: string) => name === member)).toHaveLength(1);
    expect(after.groups.flatMap((group: { members: string[] }) => group.members)).toHaveLength(before.flatMap((group: { members: string[] }) => group.members).length);
  });
  it('retire un collègue des groupes sans supprimer son compte et permet de le restaurer', async () => {
    const before = (await overview()).groups;
    const member = before[0].members[0];
    expect((await handler(post({ action: 'remove-member', member }))).status).toBe(200);
    expect(admin.listUsers).not.toHaveBeenCalled();
    const removed = await overview();
    expect(removed.groups.flatMap((item: { members: string[] }) => item.members)).not.toContain(member);
    expect(removed.trash).toEqual([expect.objectContaining({ title: member, kind: 'group-member' })]);
    expect((await handler(post({ action: 'restore', id: removed.trash[0].id }))).status).toBe(200);
    const restored = await overview();
    expect(restored.groups[0].members).toContain(member);
    expect(restored.trash).toHaveLength(0);
  });
  it('restaure un fichier et refuse sa restauration au-delà de 30 jours', async () => {
    const added = await (await documents(post(upload({ notifyGuests: false }), 'useful-documents'))).json();
    await documents(post({ action: 'delete-document', documentId: added.document.id }, 'useful-documents'));
    const item = (await overview()).trash[0];
    expect(JSON.stringify(item)).not.toContain('contentBase64');
    expect((await documents(get(`useful-documents?file=${added.document.id}`))).status).toBe(404);
    expect((await handler(post({ action: 'restore', id: item.id }))).status).toBe(200);
    expect((await documents(get(`useful-documents?file=${added.document.id}`))).status).toBe(200);
    await documents(post({ action: 'delete-document', documentId: added.document.id }, 'useful-documents'));
    const expired = (await overview()).trash[0]; vi.setSystemTime(new Date('2026-10-10T10:00:00Z'));
    expect((await handler(post({ action: 'restore', id: expired.id }))).status).toBe(410);
    await runPublications(adminStore()); expect([...data.keys()].filter(key => key.startsWith('admin-tools/trash/'))).toHaveLength(0);
  });
  it('restaure un contact et un formulaire intégré avec son titre personnalisé', async () => {
    const initial = await (await contacts(get('contacts'))).json(); const contact = initial.gprmn[0];
    await contacts(post({ action: 'delete', id: contact.id }, 'contacts'));
    const item = (await overview()).trash[0]; await handler(post({ action: 'restore', id: item.id }));
    expect((await (await contacts(get('contacts'))).json()).gprmn).toContainEqual(contact);
    await documents(post({ action: 'rename-document', documentId: 'demande-conges.pdf', title: 'Titre personnalisé' }, 'useful-documents'));
    await documents(post({ action: 'delete-document', documentId: 'demande-conges.pdf' }, 'useful-documents'));
    await handler(post({ action: 'restore', id: (await overview()).trash[0].id }));
    expect(data.get('useful-documents/catalog/demande-conges.pdf')).toEqual({ id: 'demande-conges.pdf', title: 'Titre personnalisé' });
  });
  it('cache la publication future et son fichier, puis diffuse une seule fois à échéance', async () => {
    const added = await (await documents(post(upload({ publishAt: '2026-09-09T11:00:00Z' }), 'useful-documents'))).json();
    guest(); expect((await (await documents(get('useful-documents'))).json()).documents).toHaveLength(0);
    expect((await documents(get(`useful-documents?file=${added.document.id}`))).status).toBe(404);
    await runPublications(adminStore()); expect(sendDocumentAnnouncementEmail).not.toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-09-09T11:00:00Z'));
    await Promise.all([runPublications(adminStore()), runPublications(adminStore())]);
    await runPublications(adminStore());
    expect(sendDocumentAnnouncementEmail).toHaveBeenCalledTimes(2);
    expect((await (await documents(get('useful-documents'))).json()).documents).toHaveLength(1);
    expect((await documents(get(`useful-documents?file=${added.document.id}`))).status).toBe(200);
  });
  it('annule une publication future et ne diffuse pas un document supprimé', async () => {
    await documents(post(upload({ publishAt: '2026-09-09T11:00:00Z' }), 'useful-documents'));
    await handler(post({ action: 'cancel-job', id: (await overview()).jobs[0].id }));
    vi.setSystemTime(new Date('2026-09-09T11:01:00Z')); await runPublications(adminStore());
    expect(sendDocumentAnnouncementEmail).not.toHaveBeenCalled();
    guest(); expect((await (await documents(get('useful-documents'))).json()).documents).toHaveLength(0);
    owner(); const added = await (await documents(post(upload({ publishAt: '2026-09-09T12:00:00Z' }), 'useful-documents'))).json();
    await documents(post({ action: 'delete-document', documentId: added.document.id }, 'useful-documents'));
    vi.setSystemTime(new Date('2026-09-09T12:01:00Z')); await runPublications(adminStore());
    expect(sendDocumentAnnouncementEmail).not.toHaveBeenCalled();
    expect((await overview()).jobs.some((job: { status: string }) => job.status === 'error')).toBe(true);
  });
  it('compte chaque affichage une seule fois, refuse les faux reçus et relance uniquement les non-vus', async () => {
    await documents(post({ action: 'share-document', documentId: 'demande-conges.pdf', audience: 'all', message: 'À consulter' }, 'useful-documents'));
    const alert = (await overview()).alerts[0]; guest();
    await documents(post({ action: 'seen-notification', id: alert.id }, 'useful-documents'));
    await documents(post({ action: 'seen-notification', id: alert.id }, 'useful-documents'));
    guest('outside'); expect((await documents(post({ action: 'seen-notification', id: alert.id }, 'useful-documents'))).status).toBe(404);
    owner(); expect((await overview()).alerts[0]).toMatchObject({ seen: 1, total: 2, unseenIds: ['guest-2'] });
    vi.mocked(sendDocumentAnnouncementEmail).mockClear();
    await documents(post({ action: 'share-document', documentId: alert.documentId, audience: 'selected', recipientIds: ['guest-1', 'guest-2'], message: 'Rappel', reminderId: alert.id }, 'useful-documents'));
    expect(sendDocumentAnnouncementEmail).toHaveBeenCalledExactlyOnceWith('two@example.test', 'Demande de congés', 'Formulaire SAP');
  });
  it('reprogramme un brouillon annulé et maintient son invisibilité avant la nouvelle date', async () => {
    const added = await (await documents(post(upload({ publishAt: '2026-09-09T11:00:00Z' }), 'useful-documents'))).json();
    const id = (await overview()).jobs[0].id;
    await handler(post({ action: 'cancel-job', id }));
    expect((await handler(post({ action: 'reschedule-job', id, at: '2026-09-09T12:00:00Z' }))).status).toBe(200);
    vi.setSystemTime(new Date('2026-09-09T11:30:00Z')); await runPublications(adminStore());
    guest(); expect((await documents(get(`useful-documents?file=${added.document.id}`))).status).toBe(404);
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z')); await runPublications(adminStore());
    expect((await documents(get(`useful-documents?file=${added.document.id}`))).status).toBe(200);
    expect(sendDocumentAnnouncementEmail).toHaveBeenCalledTimes(2);
  });
  it('rend visible un échec mail sans renvoyer en boucle ni perdre les alertes déposées', async () => {
    await documents(post(upload({ publishAt: '2026-09-09T11:00:00Z' }), 'useful-documents'));
    vi.mocked(sendDocumentAnnouncementEmail).mockRejectedValueOnce(new Error('SMTP indisponible'));
    vi.setSystemTime(new Date('2026-09-09T11:00:00Z')); await runPublications(adminStore());
    await runPublications(adminStore());
    const state = await overview(); expect(state.jobs[0].status).toBe('error');
    expect(state.alerts[0]).toMatchObject({ sent: 1, emailsSent: 0, total: 2 });
    expect(sendDocumentAnnouncementEmail).toHaveBeenCalledTimes(1);
  });
});
