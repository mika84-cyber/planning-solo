import { useEffect, useRef, useState } from "react";
import { editUsefulDocument, getUsefulDocumentVersions, replaceUsefulDocument, restoreUsefulDocumentVersion, type UsefulDocumentEdit, type UsefulDocumentVersion } from "./usefulDocumentsApi";

type DemoVersion = UsefulDocumentVersion & { href: string };
const demoHistory = new Map<string, DemoVersion[]>();

export function DocumentEditDialog({ document, demoMode, onClose, onEdited }: {
  document: { file: string; title: string; format?: 'PDF' | 'DOCX'; href?: string }; demoMode: boolean; onClose: () => void; onEdited: (edit: UsefulDocumentEdit) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(document.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [versions, setVersions] = useState<UsefulDocumentVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [status, setStatus] = useState('');
  const currentDemo = useRef({ href: document.href || `/useful-forms/${document.file}`, filename: 'Document actuel' });
  const format = document.format || (document.file.endsWith('.docx') ? 'DOCX' : 'PDF');
  const refreshVersions = async () => {
    const result = demoMode ? demoHistory.get(document.file) || [] : (await getUsefulDocumentVersions(document.file)).versions;
    setVersions(result);
  };
  const changeFile = async (versionId?: string) => {
    if (busy || (!versionId && !file)) return;
    setBusy(true); setError(''); setStatus('');
    try {
      if (!versionId && file) {
        if (file.size > 3 * 1024 * 1024) throw new Error('Le document dépasse la taille maximale de 3 Mo.');
        if (!file.name.toLowerCase().endsWith(`.${format.toLowerCase()}`)) throw new Error(`Choisissez un fichier ${format}.`);
      }
      if (demoMode) {
        const history = demoHistory.get(document.file) || [];
        const previous = { ...currentDemo.current, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
        const next = versionId ? history.find(item => item.id === versionId) : { href: URL.createObjectURL(file!), filename: file!.name };
        if (!next) throw new Error('Version introuvable.');
        demoHistory.set(document.file, [previous, ...history]); currentDemo.current = next;
        onEdited({ id: document.file, href: next.href });
      } else {
        if (versionId) await restoreUsefulDocumentVersion(document.file, versionId);
        else await replaceUsefulDocument(document.file, file!);
      }
      setStatus(`${versionId ? 'Version restaurée' : 'Document remplacé'}${demoMode ? ' dans cette démo' : ''}. Le titre, la rubrique et le lien sont conservés.`);
      setFile(null);
      await refreshVersions();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Remplacement impossible.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { ref.current?.showModal(); }, []);
  const save = async (deleting: boolean) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = demoMode ? deleting ? { deleted: true } : { title: title.trim() }
        : await editUsefulDocument(document.file, deleting ? "delete-document" : "rename-document", title);
      onEdited({ id: document.file, ...result }); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Modification impossible."); }
    finally { setBusy(false); }
  };
  return <dialog ref={ref} className="document-share-dialog" aria-labelledby="document-edit-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id="document-edit-title">Modifier le document</h2><button type="button" aria-label="Fermer" onClick={onClose} disabled={busy}>×</button></header>
    <p className="document-share-name">{document.title}</p>
      {confirmDelete ? <><p>Supprimer ce document de la liste pour tous les utilisateurs ? Vous pourrez le restaurer pendant 30 jours dans la corbeille administrateur.</p><button type="button" disabled={busy} onClick={() => void save(true)}>Confirmer la suppression</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Annuler</button></> : <form onSubmit={event => { event.preventDefault(); void save(false); }}>
      <label className="document-share-message">Titre du document<input type="text" required minLength={3} maxLength={120} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
      <button type="submit" disabled={busy || title.trim().length < 3}>{busy ? "Enregistrement…" : "Enregistrer le titre"}</button>
      <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Supprimer le document</button>
    </form>}
    {!confirmDelete && <section className="document-version-section">
      <h3>Mettre à jour le fichier</h3>
      <p>La nouvelle version sera disponible pour les mêmes destinataires. Vous pourrez revenir à une version précédente.</p>
      <form onSubmit={event => { event.preventDefault(); void changeFile(); }}>
        <label className="document-share-message">Nouveau fichier {format}<input key={status} type="file" required accept={`.${format.toLowerCase()}`} disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} /><small>3 Mo maximum · Alerte facultative depuis le bouton de partage.</small></label>
        <button disabled={busy || !file}>{busy ? 'Enregistrement…' : 'Remplacer le fichier'}</button>
      </form>
      <details onToggle={event => { if (event.currentTarget.open && !historyOpen) { setHistoryOpen(true); void refreshVersions().catch(() => setError('Historique indisponible. Réessayez en rouvrant le document.')); } }}>
        <summary>Versions précédentes</summary>
        {versions.length ? versions.map(version => <article key={version.id}><strong>{version.filename}</strong><small>Conservée le {new Date(version.savedAt).toLocaleString('fr-FR')}</small><button type="button" disabled={busy} onClick={() => void changeFile(version.id)}>Restaurer cette version</button></article>) : <p>Aucune version précédente.</p>}
      </details>
    </section>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
