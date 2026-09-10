import { useEffect, useRef, useState, type FormEvent } from "react";
import type { UsefulContact } from "./usefulContactsTypes";

export function ContactEditDialog({ contact, mode, onClose, onSave, onDelete }: {
  contact?: UsefulContact; mode: "add" | "edit"; onClose: () => void;
  onSave: (contact: UsefulContact) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(contact?.name || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phones?.[0]?.number || "");
  const [mobile, setMobile] = useState(contact?.phones?.[1]?.number || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(""); try { await action(); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Modification impossible."); } finally { setBusy(false); } };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const phones = [{ label: "Bureau", number: phone }, { label: "Portable", number: mobile }].filter(item => item.number.trim());
    void run(() => onSave({ id: contact?.id, name: name.trim(), email: email.trim() || undefined, phones }));
  };
  return <dialog ref={ref} className="document-share-dialog contact-edit-dialog" aria-labelledby="contact-edit-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><small>ANNUAIRE ADMINISTRATEUR</small><h2 id="contact-edit-title">{mode === "add" ? "Ajouter un contact" : "Modifier le contact"}</h2></div><button type="button" aria-label="Fermer" disabled={busy} onClick={onClose}>×</button></header>
    {confirmDelete ? <><p>Supprimer <strong>{contact?.name}</strong> de l’annuaire pour tous les utilisateurs ?</p><button type="button" disabled={busy} onClick={() => void run(onDelete!)}>Confirmer la suppression</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Annuler</button></> : <form onSubmit={submit}>
      <label>Nom<input required minLength={2} maxLength={100} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <label>Adresse e-mail<input type="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
      <label>Téléphone fixe<input inputMode="tel" value={phone} disabled={busy} onChange={event => setPhone(event.target.value)} /></label>
      <label>Portable<input inputMode="tel" value={mobile} disabled={busy} onChange={event => setMobile(event.target.value)} /></label>
      <small>Renseignez au moins une adresse e-mail ou un numéro.</small>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || name.trim().length < 2 || (!email.trim() && !phone.trim() && !mobile.trim())}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      {mode === "edit" && onDelete ? <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Supprimer le contact</button> : null}
    </form>}
  </dialog>;
}
