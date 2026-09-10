import { useState, type FormEvent } from "react";
import { addSharedUsefulDocument, type SharedUsefulDocument, type UsefulDocumentFolderKey } from "./usefulDocumentsApi";

export function DocumentUpload({ folder, demoMode, onAdded }: {
  folder: UsefulDocumentFolderKey; demoMode: boolean; onAdded: (document: SharedUsefulDocument) => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishAt, setPublishAt] = useState('');
  const [notifyGuests, setNotifyGuests] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || busy) return;
    const form = event.currentTarget;
    setBusy(true); setError(""); setSuccess("");
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("Le document dépasse la taille maximale de 3 Mo.");
      if (!/\.(pdf|docx)$/i.test(file.name)) throw new Error("Choisissez un fichier PDF ou DOCX.");
      const document = demoMode ? {
        id: `demo-${Date.now()}`, title: title.trim(), folder,
        format: /\.pdf$/i.test(file.name) ? "PDF" as const : "DOCX" as const,
        createdAt: new Date().toISOString(), href: URL.createObjectURL(file), ...(publishAt ? { publishAt: new Date(publishAt).toISOString() } : {}),
      } : (await addSharedUsefulDocument({ title, folder, file, notifyGuests: Boolean(publishAt && notifyGuests), ...(publishAt ? { publishAt: new Date(publishAt).toISOString(), message } : {}) })).document;
      onAdded(document);
      setTitle(""); setFile(null); form.reset();
      setSuccess(demoMode ? "Document ajouté à la démo uniquement. Aucun e-mail envoyé." : publishAt ? 'Document programmé. Retrouvez la programmation dans les outils administrateur.' : "Document ajouté et visible par tous. Pour envoyer une alerte, utilisez son bouton de partage.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ajout impossible. Réessayez."); }
    finally { setBusy(false); }
  };
  return <details className="useful-document-admin-panel">
    <summary><span aria-hidden="true">＋</span><strong>Ajouter un document</strong><small>Administrateur</small></summary>
    <form onSubmit={event => void submit(event)}>
      <label><span>Titre du document</span><input required minLength={3} maxLength={120} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
      <label className="useful-document-file"><span>Fichier PDF ou DOCX</span><input type="file" required accept=".pdf,.docx" disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} /><small>3 Mo maximum · Visible par tous à sa publication. L’envoi d’une alerte reste facultatif.</small></label>
      <label><span>Publication différée (facultatif)</span><input type="datetime-local" value={publishAt} disabled={busy} onChange={event => setPublishAt(event.target.value)} /><small>Heure de cet appareil. Vide : publication immédiate.</small></label>
      {publishAt && <><label><input type="checkbox" checked={notifyGuests} disabled={busy} onChange={event => setNotifyGuests(event.target.checked)} />Prévenir tous les invités à la publication</label>{notifyGuests && <label>Message de l’alerte<textarea maxLength={1000} value={message} onChange={event => setMessage(event.target.value)} /></label>}</>}
      <button type="submit" disabled={busy || !file || title.trim().length < 3}>{busy ? "Ajout en cours…" : publishAt ? 'Programmer le document' : "Ajouter le document"}</button>
      {error && <p className="useful-form-download-error" role="alert">{error}</p>}
      {success && <p className="useful-document-admin-success" role="status">{success}</p>}
    </form>
  </details>;
}
