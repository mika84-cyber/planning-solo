import { getUser } from '@netlify/identity';
import { isTrustedMutation } from '../lib/requestSecurity.mts';
import { adminStore, archive, isOwner, records, readGroups, groupsKey, trashValid, futureDate, receiptKey, type Trash, type Pin, type Delivery, type Job } from '../lib/adminTools.mts';
import type { UsefulContactsPayload, UsefulContact } from '../../src/usefulContactsTypes.ts';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
export default async function handler(request: Request) {
  if (!isTrustedMutation(request)) return json({ error: 'Requête refusée.' }, 403);
  const user = await getUser();
  if (!user?.id || !user.email) return json({ error: 'Connexion requise.' }, 401);
  const store = adminStore();
  const owner = isOwner(user.email);
  if (request.method === 'GET') {
    const pin = await store.get('admin-tools/pin', { type: 'json' }) as Pin | null;
    if (!owner || new URL(request.url).searchParams.has('public')) return json({ pin: pin && Date.parse(pin.until) > Date.now() ? pin : null });
    const trash = (await records<Trash>(store, 'admin-tools/trash/')).filter(trashValid).map(({ entries: _entries, ...item }) => item);
    const deliveries = await records<Delivery>(store, 'admin-tools/deliveries/');
    const alerts = await Promise.all(deliveries.map(async delivery => {
      const seen = await Promise.all(delivery.recipients.map(guest => store.get(receiptKey(guest.id, delivery.notice.id), { type: 'json' })));
      return { id: delivery.notice.id, title: delivery.notice.title, documentId: delivery.notice.documentId, message: delivery.notice.message, total: delivery.recipients.length, sent: delivery.alertSent.length, emailsSent: delivery.emailSent.length, seen: seen.filter(Boolean).length, unseenIds: delivery.recipients.filter((_, index) => !seen[index]).map(guest => guest.id), createdAt: delivery.createdAt };
    }));
    const jobs = (await records<Job>(store, 'admin-tools/jobs/')).map(({ recipients: _recipients, notice: _notice, ...job }) => job);
    return json({ pin, trash, alerts, jobs, groups: await readGroups(store) });
  }
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!owner) return json({ error: 'Réservé au compte administrateur.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Données invalides.' }, 400);
  try {
    if (body.action === 'pin') {
      if (body.message === '') await store.delete('admin-tools/pin');
      else {
        if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000) return json({ error: 'Message requis, 1 000 caractères maximum.' }, 400);
        const until = futureDate(body.until);
        if (!until) return json({ error: 'Une date de fin est nécessaire.' }, 400);
        await store.setJSON('admin-tools/pin', { message: body.message.trim(), until });
      }
    } else if (body.action === 'move-member') {
      if (typeof body.member !== 'string' || ![1, 2, 3].includes(body.group)) return json({ error: 'Collègue ou groupe invalide.' }, 400);
      const groups = await readGroups(store);
      if (!groups.some(group => group.members.includes(body.member))) return json({ error: 'Collègue introuvable.' }, 404);
      const next = groups.map(group => ({ ...group, members: [...group.members.filter(name => name !== body.member), ...(group.number === body.group ? [body.member] : [])].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })) }));
      await store.setJSON(groupsKey, next);
    } else if (body.action === 'remove-member') {
      if (typeof body.member !== 'string' || !body.member.trim()) return json({ error: 'Collègue invalide.' }, 400);
      const groups = await readGroups(store);
      const previousGroup = groups.find(group => group.members.includes(body.member));
      if (!previousGroup) return json({ error: 'Collègue introuvable.' }, 404);
      await archive(store, { kind: 'group-member', title: body.member, entries: [{ key: 'admin-tools/group-member', value: { member: body.member, group: previousGroup.number } }] });
      await store.setJSON(groupsKey, groups.map(group => ({ ...group, members: group.members.filter(name => name !== body.member) })));
    } else if (body.action === 'reschedule-job') {
      if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) return json({ error: 'Publication invalide.' }, 400);
      const key = `admin-tools/jobs/${body.id}`;
      const job = await store.get(key, { type: 'json' }) as Job | null;
      if (!job || !['cancelled', 'pending'].includes(job.status) || (job.status === 'pending' && Date.parse(job.at) <= Date.now())) return json({ error: 'Cette publication a déjà démarré.' }, 409);
      const at = futureDate(body.at);
      if (!at) return json({ error: 'Une nouvelle date est nécessaire.' }, 400);
      if (job.publishesDocument) {
        const docKey = `useful-documents/metadata/${job.documentId}`;
        const doc = await store.get(docKey, { type: 'json' });
        if (!doc) return json({ error: 'Document supprimé.' }, 404);
        await store.setJSON(docKey, { ...doc, publishAt: at });
      }
      await store.setJSON(key, { ...job, at, status: 'pending', ...(job.notice ? { notice: { ...job.notice, createdAt: at } } : {}) });
    } else if (body.action === 'cancel-job') {
      if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) return json({ error: 'Publication invalide.' }, 400);
      const key = `admin-tools/jobs/${body.id}`;
      const job = await store.get(key, { type: 'json' }) as Job | null;
      if (!job || job.status !== 'pending' || Date.parse(job.at) <= Date.now()) return json({ error: 'Cette publication a déjà démarré.' }, 409);
      await store.setJSON(key, { ...job, status: 'cancelled' });
      // Un document programmé annulé reste un brouillon administrateur.
      const docKey = `useful-documents/metadata/${job.documentId}`;
      const doc = await store.get(docKey, { type: 'json' }) as Record<string, unknown> | null;
      if (job.publishesDocument && doc?.publishAt === job.at) await store.setJSON(docKey, { ...doc, publishAt: '9999-01-01T00:00:00.000Z' });
    } else if (body.action === 'restore') {
      if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) return json({ error: 'Élément invalide.' }, 400);
      const key = `admin-tools/trash/${body.id}`;
      const item = await store.get(key, { type: 'json' }) as Trash | null;
      if (!item || !trashValid(item)) return json({ error: 'Le délai de restauration est dépassé.' }, 410);
      if (item.kind === 'group-member') {
        const payload = item.entries[0]?.value as { member?: unknown; group?: unknown } | undefined;
        if (typeof payload?.member !== 'string' || ![1, 2, 3].includes(payload.group as number)) return json({ error: 'Collègue invalide dans la corbeille.' }, 409);
        const groups = await readGroups(store);
        if (groups.some(group => group.members.includes(payload.member as string))) return json({ error: 'Ce collègue figure déjà dans les groupes.' }, 409);
        const next = groups.map(group => ({ ...group, members: group.number === payload.group
          ? [...group.members, payload.member as string].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
          : [...group.members] }));
        await store.setJSON(groupsKey, next);
      } else if (item.kind === 'contact') {
        const payload = item.entries[0].value as { contact: UsefulContact; section?: string };
        const directory = await store.get('useful-contacts/admin-directory', { type: 'json' }) as UsefulContactsPayload | null;
        if (!directory) return json({ error: 'Annuaire indisponible.' }, 409);
        const list = payload.section ? directory.pompidou.find(section => section.key === payload.section)?.contacts : directory.gprmn;
        if (!list) return json({ error: 'Rubrique introuvable.' }, 409);
        if (!list.some(contact => contact.id === payload.contact.id)) list.push(payload.contact);
        await store.setJSON('useful-contacts/admin-directory', directory);
      } else {
        const metadata = item.entries.find(entry => entry.key.startsWith('useful-documents/metadata/'));
        if (metadata && await store.get(metadata.key, { type: 'json' })) return json({ error: 'Ce document existe déjà : restauration refusée pour préserver sa version actuelle.' }, 409);
        const catalog = item.entries.find(entry => entry.key.startsWith('useful-documents/catalog/'));
        if (catalog) {
          const current = await store.get(catalog.key, { type: 'json' }) as { deleted?: boolean } | null;
          if (!current?.deleted) return json({ error: 'Ce document a déjà été restauré.' }, 409);
        }
        for (const entry of item.entries) {
          if (entry.value === null) await store.delete(entry.key);
          else await store.setJSON(entry.key, entry.value);
        }
      }
      await store.delete(key);
    } else return json({ error: 'Action inconnue.' }, 400);
    return json({ ok: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Action impossible.' }, 400); }
}
export const config = { path: '/api/admin-tools' };
