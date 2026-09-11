import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ColleagueGroup } from './colleagueGroups';
import { matchesSearch } from './searchMatching';
import { shareUsefulDocument } from './usefulDocumentsApi';
import './adminTools.css';
import { adminToolsApi as api, demoPin, setDemoPin, type Pin } from './adminToolsApi';
type Overview = {
  pin: Pin | null; groups: readonly ColleagueGroup[];
  trash: Array<{ id: string; title: string; kind: string; deletedAt: string }>;
  jobs: Array<{ id: string; title: string; at: string; status: string; error?: string }>;
  alerts: Array<{ id: string; title: string; documentId: string; message?: string; total: number; seen: number; sent: number; emailsSent: number; unseenIds: string[]; createdAt: string }>;
};
const formatDate = (date: string) => new Date(date).toLocaleString('fr-FR');
const localInput = (date: string) => { const value = new Date(date); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const demoOverview = (): Overview => ({ pin: demoPin, trash: [], jobs: [], alerts: [], groups: [1, 2, 3].map(number => ({ number: number as 1 | 2 | 3, members: number === 1 ? ['Camille Exemple'] : number === 2 ? ['Alex Exemple'] : [] })) });


export function AdminToolsPanel({ demoMode, onClose, onPreview, onChanged }: { demoMode: boolean; onClose: () => void; onPreview: () => void; onChanged: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [status, setStatus] = useState('');
  const [message, setMessage] = useState(''); const [until, setUntil] = useState('');
  const [member, setMember] = useState(''); const [group, setGroup] = useState(1); const [search, setSearch] = useState('');
  const [confirmation, setConfirmation] = useState<Overview['alerts'][number] | null>(null);
  const [jobDates, setJobDates] = useState<Record<string, string>>({});
  useEffect(() => {
    dialog.current?.showModal(); let active = true;
    void (demoMode ? Promise.resolve(demoOverview()) : api<Overview>()).then(result => {
      if (!active) return; setData(result); setMessage(result.pin?.message || ''); setUntil(result.pin ? localInput(result.pin.until) : '');
    }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [demoMode]);
  async function act(payload: Record<string, unknown>) {
    if (busy) return; setBusy(true); setError(''); setStatus('');
    try {
      if (demoMode) {
        if (payload.action === 'pin') { setDemoPin(payload.message ? { message: String(payload.message), until: String(payload.until) } : null); setData(current => current && { ...current, pin: demoPin }); }
        if (payload.action === 'move-member') setData(current => current && { ...current, groups: current.groups.map(item => ({ ...item, members: [...item.members.filter(name => name !== payload.member), ...(item.number === payload.group ? [String(payload.member)] : [])].sort((a, b) => a.localeCompare(b, 'fr')) })) });
        if (payload.action === 'remove-member') setData(current => current && { ...current, groups: current.groups.map(item => ({ ...item, members: item.members.filter(name => name !== payload.member) })) });
      } else { await api(payload); setData(await api<Overview>()); }
      if (payload.action === 'remove-member') setMember('');
      setStatus(demoMode ? 'Modification simulée dans cette démo.' : 'Modification enregistrée.'); onChanged(); window.dispatchEvent(new Event('admin-tools-updated'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action impossible.'); } finally { setBusy(false); }
  }
  async function remind() {
    if (!confirmation || busy) return; setBusy(true); setError('');
    try {
      if (!demoMode) {
        const result = await shareUsefulDocument({ documentId: confirmation.documentId, audience: 'selected', recipientIds: confirmation.unseenIds, message: confirmation.message || `Rappel : ${confirmation.title}`, reminderId: confirmation.id });
        setStatus(`${result.inAppAlerts} alertes et ${result.emailsSent} e-mails envoyés sur ${result.accounts} destinataires.`); setData(await api<Overview>());
      } else setStatus('Relance simulée. Aucun e-mail envoyé.');
      setConfirmation(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Relance impossible.'); } finally { setBusy(false); }
  }
  return createPortal(<dialog ref={dialog} className="admin-tools-dialog" aria-labelledby="admin-tools-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><small>VOTRE COMPTE UNIQUEMENT</small><h2 id="admin-tools-title">Outils administrateur</h2></div><button type="button" aria-label="Fermer les outils administrateur" disabled={busy} onClick={onClose}>×</button></header>
    {demoMode && <p>Démo : les modifications et les envois sont simulés.</p>}
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    <section><h3>Aperçu invité</h3><p>Parcourez l’interface sans les outils administrateur. Les données personnelles affichées restent les vôtres.</p><button type="button" disabled={busy} onClick={onPreview}>Voir comme un invité</button></section>
    {!data && !error && <p role="status">Chargement des outils…</p>}
    {data && <>
      <details open><summary>Message temporaire sur l’accueil</summary><form onSubmit={event => { event.preventDefault(); void act({ action: 'pin', message, until: new Date(until).toISOString() }); }}>
        <label>Message<textarea required maxLength={1000} value={message} onChange={event => setMessage(event.target.value)} /></label>
        <label>Afficher jusqu’au<input type="datetime-local" required value={until} onChange={event => setUntil(event.target.value)} /></label><small>Heure de cet appareil · Tous les comptes invités.</small>
        <button type="submit" disabled={busy || !message.trim() || !until}>Enregistrer le message</button>{data.pin && <button type="button" disabled={busy} onClick={() => void act({ action: 'pin', message: '' })}>Retirer le message</button>}
      </form></details>
      <details><summary>Publications programmées ({data.jobs.filter(job => job.status === 'pending').length})</summary><p>Programmez un document depuis « Ajouter un document », ou une alerte depuis son bouton de partage. Vérification chaque minute.</p>
        {data.jobs.length ? data.jobs.map(job => <article key={job.id}><strong>{job.title}</strong><p>{formatDate(job.at)} · {({ pending: 'Programmée', done: 'Terminée', cancelled: 'Annulée', error: 'À vérifier' } as Record<string, string>)[job.status]}</p>{job.error && <p role="alert">{job.error}</p>}{job.status === 'pending' && <button type="button" disabled={busy} onClick={() => void act({ action: 'cancel-job', id: job.id })}>Annuler la programmation</button>}{['pending', 'cancelled'].includes(job.status) && <form onSubmit={event => { event.preventDefault(); void act({ action: 'reschedule-job', id: job.id, at: new Date(jobDates[job.id]).toISOString() }); }}><label>Nouvelle date<input type="datetime-local" required value={jobDates[job.id] || ''} onChange={event => setJobDates(current => ({ ...current, [job.id]: event.target.value }))} /></label><button type="submit" disabled={busy || !jobDates[job.id]}>Reprogrammer</button></form>}</article>) : <p>Aucune publication programmée.</p>}
      </details>
      <details><summary>Suivi des alertes ({data.alerts.length})</summary><p>« Vue » signifie que la popup a été affichée, pas que le document a été lu. Le suivi commence avec les nouveaux partages.</p>
        {data.alerts.length ? data.alerts.map(alert => <article key={alert.id}><strong>{alert.title}</strong><p>{formatDate(alert.createdAt)}</p><p>Vue par {alert.seen} personnes sur {alert.total}</p><small>{alert.sent} alertes déposées · {alert.emailsSent} e-mails envoyés</small>{alert.unseenIds.length > 0 && <button type="button" disabled={busy} onClick={() => setConfirmation(alert)}>Relancer les {alert.unseenIds.length} personnes restantes</button>}</article>) : <p>Aucune alerte suivie pour le moment.</p>}
        {confirmation && <section><p>Envoyer une nouvelle alerte et un e-mail aux {confirmation.unseenIds.length} destinataires qui n’ont pas vu « {confirmation.title} » ?</p><button type="button" disabled={busy} onClick={() => void remind()}>Confirmer la relance</button><button type="button" disabled={busy} onClick={() => setConfirmation(null)}>Annuler</button></section>}
      </details>
      <details><summary>Corbeille ({data.trash.length})</summary><p>Documents, contacts et collègues récupérables pendant 30 jours. Les anciennes suppressions définitives ne peuvent pas être récupérées.</p>
        {data.trash.length ? data.trash.map(item => <article key={item.id}><strong>{item.title}</strong><small>{item.kind === 'contact' ? 'Contact' : item.kind === 'group-member' ? 'Collègue retiré des groupes' : 'Document'} · Supprimé le {formatDate(item.deletedAt)}</small><button type="button" disabled={busy} onClick={() => void act({ action: 'restore', id: item.id })}>Restaurer</button></article>) : <p>La corbeille est vide.</p>}
      </details>
      <details><summary>Composition des groupes</summary><p>{data.groups.map(item => `Groupe ${item.number} : ${item.members.length}`).join(' · ')}</p><p>Modifie l’annuaire de l’équipe. Le cycle personnel de planning reste réglé par chaque collègue.</p>
        <label>Rechercher un collègue<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <form onSubmit={event => { event.preventDefault(); void act({ action: 'move-member', member, group }); }}><label>Collègue<select aria-label="Collègue" required value={member} onChange={event => setMember(event.target.value)}><option value="">Choisir un collègue</option>{data.groups.flatMap(item => item.members.filter(name => matchesSearch(name, search)).map(name => <option key={name} value={name}>{name} · Groupe {item.number}</option>))}</select></label>
        <label>Nouveau groupe<select aria-label="Nouveau groupe" value={group} onChange={event => setGroup(Number(event.target.value))}>{[1, 2, 3].map(value => <option key={value} value={value}>Groupe {value}</option>)}</select></label><div><button type="submit" disabled={busy || !member}>Déplacer le collègue</button><button className="admin-danger" type="button" disabled={busy || !member} onClick={() => { if (window.confirm(`Retirer ${member} des trois groupes ? Son compte Netlify et ses données seront conservés.`)) void act({ action: 'remove-member', member }); }}>Retirer des groupes</button></div></form>
      </details>
    </>}
  </dialog>, document.body);
}
