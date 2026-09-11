import { getStore } from '@netlify/blobs';
import { COLLEAGUE_GROUPS, type ColleagueGroup } from './colleagueGroups.ts';
import { sendDocumentAnnouncementEmail } from './documentAnnouncementEmail.mts';

export type Store = ReturnType<typeof getStore>;
export const adminStore = () => getStore({ name: 'planning-solo', consistency: 'strong' });
export function isOwner(email?: string) {
  const configured = (globalThis as typeof globalThis & { Netlify?: { env?: { get(name: string): string | undefined } } }).Netlify?.env?.get('PROGRAM_ADMIN_EMAIL');
  return Boolean(configured?.trim() && email?.trim().toLowerCase() === configured.trim().toLowerCase());
}
export async function records<T>(store: Store, prefix: string): Promise<T[]> {
  const keys: string[] = [];
  for await (const page of store.list({ prefix, paginate: true })) keys.push(...page.blobs.map(blob => blob.key));
  return (await Promise.all(keys.map(key => store.get(key, { type: 'json' })))).filter(item => item !== null) as T[];
}
export const groupsKey = 'admin-tools/groups';
export async function readGroups(store: Store): Promise<readonly ColleagueGroup[]> {
  return await store.get(groupsKey, { type: 'json' }) as ColleagueGroup[] | null || COLLEAGUE_GROUPS;
}
export type Pin = { message: string; until: string };
export type Trash = { id: string; title: string; kind: 'document' | 'contact' | 'group-member'; deletedAt: string; entries: Array<{ key: string; value: unknown }> };
export const trashValid = (item: Trash) => Date.now() - Date.parse(item.deletedAt) < 30 * 86400000;
export async function archive(store: Store, input: Omit<Trash, 'id' | 'deletedAt'>) {
  const item = { ...input, id: crypto.randomUUID(), deletedAt: new Date().toISOString() };
  await store.setJSON(`admin-tools/trash/${item.id}`, item);
}
export type Notice = { id: string; documentId: string; title: string; folderTitle: string; createdAt: string; message?: string; format?: 'PDF' | 'DOCX' };
export type Delivery = { notice: Notice; recipients: Array<{ id: string; email: string }>; alertSent: string[]; emailSent: string[]; emailUncertain?: string[]; createdAt: string };
export const deliveryKey = (id: string) => `admin-tools/deliveries/${id}`;
export const receiptKey = (userId: string, id: string) => `admin-tools/seen/${id}/${encodeURIComponent(userId)}`;
export async function rememberDelivery(store: Store, notice: Notice, recipients: Delivery['recipients'], alertSent: string[], emailSent: string[]) {
  await store.setJSON(deliveryKey(notice.id), { notice, recipients, alertSent, emailSent, createdAt: notice.createdAt } satisfies Delivery);
}
export type Job = { id: string; at: string; title: string; documentId: string; publishesDocument?: boolean; notice?: Notice; recipients: Delivery['recipients']; alertSent: string[]; emailSent: string[]; emailUncertain?: string[]; status: 'pending' | 'done' | 'cancelled' | 'error'; error?: string };
export function futureDate(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now()) throw new Error('Choisissez une date et une heure futures.');
  return new Date(value).toISOString();
}
export async function runPublications(store: Store) {
  const started = Date.now();
  for (const job of await records<Job>(store, 'admin-tools/jobs/')) {
    if (Date.now() - started > 15000) break;
    if (job.status !== 'pending' || Date.parse(job.at) > Date.now()) continue;
    const lockKey = `admin-tools/locks/${job.id}`;
    const lease = await store.getWithMetadata(lockKey, { type: 'json' });
    if (lease && lease.data.until > Date.now()) continue;
    const lock = await store.setJSON(lockKey, { until: Date.now() + 120000 }, lease?.etag ? { onlyIfMatch: lease.etag } : { onlyIfNew: true });
    if (!lock.modified) continue;
    try {
      const current = await store.get(`admin-tools/jobs/${job.id}`, { type: 'json' }) as Job | null;
      if (!current || current.status !== 'pending') continue;
      Object.assign(job, current);
      const metadata = await store.get(`useful-documents/metadata/${job.documentId}`, { type: 'json' }) as { recipientIds?: string[]; publishAt?: string } | null;
      const edit = await store.get(`useful-documents/catalog/${job.documentId}`, { type: 'json' }) as { deleted?: boolean } | null;
      if ((!metadata && /^[a-f0-9-]{36}$/.test(job.documentId)) || edit?.deleted) throw new Error('Document supprimé : publication annulée.');
      if (metadata?.publishAt && Date.parse(metadata.publishAt) > Date.now()) throw new Error('Le document n’est pas encore publié. Reprogrammez son alerte après sa publication.');
      if (job.notice) {
        if (metadata?.recipientIds) await store.setJSON(`useful-documents/metadata/${job.documentId}`, { ...metadata, recipientIds: [...new Set([...metadata.recipientIds, ...job.recipients.map(guest => guest.id)])] });
        for (const guest of job.recipients) {
          if (Date.now() - started > 15000) break;
          if (!job.alertSent.includes(guest.id)) {
            await store.setJSON(`useful-documents/notices/${encodeURIComponent(guest.id)}/${job.notice.id}`, job.notice);
            job.alertSent.push(guest.id);
          }
          if (!job.emailSent.includes(guest.id) && !job.emailUncertain?.includes(guest.id)) {
            // Marquer avant l’envoi évite un doublon si le processus s’arrête après la réponse du serveur mail.
            job.emailUncertain = [...(job.emailUncertain || []), guest.id];
            await store.setJSON(`admin-tools/jobs/${job.id}`, job);
            await sendDocumentAnnouncementEmail(guest.email, job.notice.title, job.notice.folderTitle);
            job.emailSent.push(guest.id);
            job.emailUncertain = job.emailUncertain.filter(id => id !== guest.id);
          }
          await store.setJSON(`admin-tools/jobs/${job.id}`, job);
        }
      }
      job.status = !job.notice || job.recipients.every(guest => job.alertSent.includes(guest.id) && job.emailSent.includes(guest.id)) ? 'done' : job.emailUncertain?.length ? 'error' : 'pending';
      if (job.status === 'error') job.error = 'Certains e-mails ne sont pas confirmés. Consultez le suivi avant de relancer.';
    } catch (error) { job.status = 'error'; job.error = error instanceof Error ? error.message : 'Publication interrompue'; }
    if (job.notice) await rememberDelivery(store, job.notice, job.recipients, job.alertSent, job.emailSent);
    await store.setJSON(`admin-tools/jobs/${job.id}`, job);
    await store.delete(lockKey);
  }
  for (const item of await records<Trash>(store, 'admin-tools/trash/')) if (!trashValid(item)) await store.delete(`admin-tools/trash/${item.id}`);
}
