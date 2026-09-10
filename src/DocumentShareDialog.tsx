import { useEffect, useRef, useState } from "react";
import { matchesSearch } from "./searchMatching";
import { getUsefulDocumentRecipients, shareUsefulDocument } from "./usefulDocumentsApi";

export function DocumentShareDialog({ document, demoMode, onClose }: {
  document: { file: string; title: string }; demoMode: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [guests, setGuests] = useState<Array<{ id: string; name: string }>>([]);
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState(`Je vous partage le document « ${document.title} ». Vous pouvez le retrouver dans les formulaires utiles.`);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [publishAt, setPublishAt] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    const request = demoMode ? Promise.resolve({ recipients: [
      { id: "demo-1", name: "Camille Exemple" }, { id: "demo-2", name: "Alex Exemple" },
    ] }) : getUsefulDocumentRecipients();
    void request.then(data => { if (active) setGuests(data.recipients); })
      .catch(() => { if (active) setError("Impossible de charger les comptes invités. Fermez puis réessayez."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demoMode]);
  const send = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (demoMode) setResult("Simulation terminée : aucun e-mail ni aucune alerte réelle envoyés.");
      else {
        const response = await shareUsefulDocument({ documentId: document.file, audience, recipientIds: selected, message, ...(publishAt ? { publishAt: new Date(publishAt).toISOString() } : {}) });
        setResult(response.scheduled ? 'Partage programmé. Retrouvez-le dans les outils administrateur.' : `${response.inAppAlerts}/${response.accounts} alertes dans l’application · ${response.emailsSent}/${response.accounts} e-mails envoyés.${response.inAppAlerts < response.accounts || response.emailsSent < response.accounts ? " Certains envois ont échoué." : ""}`);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Partage impossible."); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="document-share-dialog" aria-labelledby="document-share-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><small>PARTAGE ADMINISTRATEUR</small><h2 id="document-share-title">Partager un document</h2></div><button type="button" aria-label="Fermer le partage" disabled={busy} onClick={onClose}>×</button></header>
    <p className="document-share-name">{document.title}</p>
    {result ? <><p role="status">{result}</p><button type="button" onClick={onClose}>Terminer</button></> : <form onSubmit={event => { event.preventDefault(); void send(); }}>
      <fieldset disabled={busy}><legend>Destinataires</legend>
        <label><input type="radio" name="audience" checked={audience === "all"} onChange={() => setAudience("all")} />Tous les comptes invités {!loading && `(${guests.length})`}</label>
        <label><input type="radio" name="audience" checked={audience === "selected"} onChange={() => setAudience("selected")} />Choisir un ou plusieurs comptes</label>
        {loading ? <p role="status">Chargement des comptes…</p> : null}
        {audience === "selected" && <><input aria-label="Rechercher un compte invité" type="search" placeholder="Rechercher un nom ou un prénom" value={query} onChange={event => setQuery(event.target.value)} /><small>{selected.length} compte(s) sélectionné(s)</small><div className="document-share-guests">{guests.filter(guest => matchesSearch(guest.name, query)).map(guest => <label key={guest.id}><input type="checkbox" checked={selected.includes(guest.id)} onChange={event => setSelected(current => event.target.checked ? [...current, guest.id] : current.filter(id => id !== guest.id))} />{guest.name}</label>)}</div></>}
      </fieldset>
      <label className="document-share-message">Message de la popup<textarea maxLength={1000} rows={4} required value={message} disabled={busy} onChange={event => setMessage(event.target.value)} /><small>{message.length}/1 000 caractères · Un e-mail prévient également chaque destinataire.</small></label>
      <label>Programmer le partage (facultatif)<input type="datetime-local" value={publishAt} disabled={busy} onChange={event => setPublishAt(event.target.value)} /><small>Heure de cet appareil. Laissez vide pour envoyer maintenant.</small></label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={busy || loading || !guests.length || !message.trim() || (audience === "selected" && !selected.length)}>{busy ? "Envoi en cours…" : demoMode ? "Simuler le partage" : "Envoyer le partage"}</button>
    </form>}
  </dialog>;
}
