import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  deleteFeedback,
  broadcastFeedback,
  FEEDBACK_PHOTO_ACCEPT,
  feedbackPhotoUrl,
  getFeedbackInbox,
  markFeedbackRead,
  prepareFeedbackPhoto,
  replyToFeedback,
  resolveFeedback,
  sendFeedback,
  type FeedbackKind,
  type FeedbackMessage,
  type FeedbackPhotoPayload,
  type FeedbackResolutionNotice,
} from "./feedbackApi";
import "./feedbackMessenger.css";

const KIND_COPY: Record<FeedbackKind, { label: string; detail: string; icon: string }> = {
  idea: { label: "Une idée", detail: "Une nouvelle possibilité", icon: "✦" },
  suggestion: { label: "Une suggestion", detail: "Une amélioration à proposer", icon: "↗" },
  bug: { label: "Un bug", detail: "Quelque chose ne fonctionne pas", icon: "!" },
};

const DEMO_MESSAGES: FeedbackMessage[] = [{
  id: "11111111-1111-1111-1111-111111111111",
  kind: "suggestion",
  message: "Ce message d’exemple montre comment apparaîtront les retours dans ta boîte privée.",
  anonymous: false,
  authorName: "Camille Dupont",
  createdAt: "2026-09-05T10:00:00.000Z",
  hasPhoto: false,
}];

export function FeedbackResolutionAlert({ notice, onDismiss }: {
  notice: FeedbackResolutionNotice;
  onDismiss: () => void;
}) {
  const isBroadcast = notice.type === "broadcast";
  const isReply = notice.type === "reply" || isBroadcast;
  return (
    <div className="feedback-resolution-backdrop" role="presentation">
      <aside className={`feedback-resolution-alert${isReply ? " reply" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="feedback-notice-title">
        <span className="feedback-resolution-check" aria-hidden="true">{isReply ? "✉" : "✓"}</span>
        <div>
          <strong id="feedback-notice-title">{isBroadcast ? "Message de Mika" : isReply ? "Vous avez reçu une réponse" : "Votre retour a été traité"}</strong>
          <small>{isReply ? notice.message : `${KIND_COPY[notice.kind].label} : ce retour est désormais marqué comme résolu.`}</small>
        </div>
        <button type="button" onClick={onDismiss}>D’accord</button>
      </aside>
    </div>
  );
}

type FeedbackMessengerProps = {
  open: boolean;
  isAdmin: boolean;
  demoMode: boolean;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
};

export function FeedbackMessenger({
  open,
  isAdmin,
  demoMode,
  onClose,
  onUnreadCountChange,
}: FeedbackMessengerProps) {
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState("");
  const [photo, setPhoto] = useState<FeedbackPhotoPayload | undefined>();
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [inboxBusy, setInboxBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !isAdmin) return;
    let active = true;
    setInboxBusy(true);
    const load = async () => {
      try {
        const payload = demoMode ? { unreadCount: 1, messages: DEMO_MESSAGES } : await getFeedbackInbox();
        if (!active) return;
        setMessages(payload.messages);
        if (demoMode) setSelectedId((current) => current || payload.messages[0]?.id || "");
        onUnreadCountChange(payload.unreadCount);
        setError("");
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "La messagerie est indisponible.");
      } finally {
        if (active) setInboxBusy(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [demoMode, isAdmin, onUnreadCountChange, open]);

  if (!open) return null;
  const selected = messages.find((item) => item.id === selectedId) || null;

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      const prepared = await prepareFeedbackPhoto(file);
      setPhoto(prepared);
      setPhotoPreview(`data:${prepared.contentType};base64,${prepared.contentBase64}`);
    } catch (photoError) {
      setPhoto(undefined);
      setPhotoPreview("");
      setError(photoError instanceof Error ? photoError.message : "Cette photo n’a pas pu être ajoutée.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 5 || busy || photoBusy) return;
    setBusy(true);
    setError("");
    try {
      if (!demoMode) await sendFeedback({ kind: "idea", message, anonymous, photo });
      setSent(true);
      setMessage("");
      setPhoto(undefined);
      setPhotoPreview("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Le message n’a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  }

  async function openMessage(item: FeedbackMessage) {
    setSelectedId(item.id);
    setReplyMessage("");
    if (item.readAt || demoMode) return;
    try {
      await markFeedbackRead(item.id);
      setMessages((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      onUnreadCountChange(Math.max(0, messages.filter((entry) => !entry.readAt).length - 1));
    } catch {
      // Le message reste consultable même si l’état de lecture ne se synchronise pas.
    }
  }

  async function resolveSelected() {
    if (!selected || selected.resolvedAt || !window.confirm("Marquer ce message comme résolu et prévenir son auteur ?")) return;
    setBusy(true);
    setError("");
    try {
      if (!demoMode) await resolveFeedback(selected.id);
      const resolvedAt = new Date().toISOString();
      setMessages((current) => current.map((entry) => entry.id === selected.id ? { ...entry, readAt: entry.readAt || resolvedAt, resolvedAt } : entry));
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "La résolution n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected || replyMessage.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      const reply = demoMode
        ? { id: crypto.randomUUID(), message: replyMessage.trim(), sentAt: new Date().toISOString() }
        : (await replyToFeedback(selected.id, replyMessage)).reply;
      setMessages((current) => current.map((entry) => entry.id === selected.id
        ? { ...entry, readAt: entry.readAt || reply.sentAt, adminReplies: [...(entry.adminReplies || []), reply] }
        : entry));
      setReplyMessage("");
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "La réponse n’a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selected || !window.confirm("Effacer définitivement ce message de votre messagerie ?")) return;
    setBusy(true);
    setError("");
    try {
      if (!demoMode) await deleteFeedback(selected.id);
      const remaining = messages.filter((entry) => entry.id !== selected.id);
      setMessages(remaining);
      setSelectedId(remaining[0]?.id || "");
      onUnreadCountChange(remaining.filter((entry) => !entry.readAt).length);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Le message n’a pas pu être effacé.");
    } finally {
      setBusy(false);
    }
  }

  async function sendBroadcast(event: FormEvent) {
    event.preventDefault();
    if (broadcastMessage.trim().length < 5 || busy) return;
    setBusy(true);
    setError("");
    setBroadcastStatus("");
    try {
      const result = demoMode
        ? { accounts: 2, delivered: 2, failed: 0 }
        : await broadcastFeedback(broadcastMessage);
      setBroadcastMessage("");
      setBroadcastStatus(demoMode
        ? "Aperçu local : le message n’a été envoyé à aucun compte."
        : `Message affiché pour ${result.delivered}/${result.accounts} compte${result.accounts > 1 ? "s" : ""} invité${result.accounts > 1 ? "s" : ""}${result.failed ? ` · ${result.failed} échec${result.failed > 1 ? "s" : ""}` : ""}. Aucun e-mail envoyé.`);
    } catch (broadcastError) {
      setError(broadcastError instanceof Error ? broadcastError.message : "Le message collectif n’a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feedback-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`feedback-dialog${isAdmin ? " inbox" : ""}`} role="dialog" aria-modal="true" aria-labelledby="feedback-title" tabIndex={-1} ref={dialogRef}>
        <header className="feedback-dialog-header">
          <div><span className="feedback-kicker">Planning Solo</span><h2 id="feedback-title">{isAdmin ? "Messages reçus" : "Une idée à partager ?"}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        {!isAdmin ? (
          sent ? (
            <div className="feedback-success">
              <span aria-hidden="true">✓</span><h3>Merci, votre message est bien arrivé.</h3>
              <p>Il restera privé. Une alerte apparaîtra dans l’application lorsque l’administratrice vous répondra ou le marquera comme résolu.</p>
              <button type="button" onClick={onClose}>Terminer</button>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={(event) => void submit(event)}>
              {demoMode ? <p className="feedback-demo-note">Aperçu local : l’envoi est simulé.</p> : null}
              <label className="feedback-message-field"><span>Votre message</span><textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 2_000))} rows={6} placeholder="Expliquez votre idée ou ce qui s’est passé…" required minLength={5} maxLength={2_000} /><small>{message.length} / 2 000</small></label>
              <div className="feedback-identity-choice">
                <label><input type="radio" name="feedback-identity" checked={!anonymous} onChange={() => setAnonymous(false)} /><span><strong>Avec mon nom</strong><small>Votre nom de compte apparaîtra automatiquement.</small></span></label>
                <label><input type="radio" name="feedback-identity" checked={anonymous} onChange={() => setAnonymous(true)} /><span><strong>Rester anonyme</strong><small>Votre identité ne sera pas visible.</small></span></label>
              </div>
              {anonymous ? <p className="feedback-privacy-note">Votre compte sert uniquement à vous remettre une éventuelle réponse. Il ne sera jamais affiché dans le message.</p> : null}
              <div className="feedback-photo-field">
                {photoPreview ? <div className="feedback-photo-preview"><img src={photoPreview} alt="Photo jointe" /><button type="button" onClick={() => { setPhoto(undefined); setPhotoPreview(""); }}>Retirer</button></div> : <label><input type="file" accept={FEEDBACK_PHOTO_ACCEPT} onChange={(event) => void choosePhoto(event)} /><span aria-hidden="true">＋</span><strong>{photoBusy ? "Préparation…" : "Joindre une photo"}</strong><small>Facultatif · JPEG, PNG ou WebP</small></label>}
              </div>
              {error ? <p className="feedback-error" role="alert">{error}</p> : null}
              <footer><p><span aria-hidden="true">◆</span> Visible uniquement dans la messagerie administrateur.</p><button type="submit" disabled={busy || photoBusy || message.trim().length < 5}>{busy ? "Envoi…" : "Envoyer le message"}</button></footer>
            </form>
          )
        ) : (<>
          <details className="feedback-broadcast">
            <summary><span aria-hidden="true">✦</span><strong>Écrire à tous les comptes invités</strong><small>Popup dans l’application uniquement · aucun e-mail</small></summary>
            <form onSubmit={(event) => void sendBroadcast(event)}>
              <label><span>Message collectif</span><textarea required minLength={5} maxLength={800} rows={3} value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value.slice(0, 800))} placeholder="Écrivez le message qui apparaîtra au centre de leur écran…" /><small>{broadcastMessage.length} / 800</small></label>
              <button type="submit" disabled={busy || broadcastMessage.trim().length < 5}>{busy ? "Envoi…" : "Afficher le message à tous"}</button>
              {broadcastStatus ? <p role="status">{broadcastStatus}</p> : null}
            </form>
          </details>
          <div className="feedback-inbox-layout">
            <div className="feedback-message-list" role="list" aria-label="Messages reçus">
              {inboxBusy ? <p className="feedback-empty">Chargement…</p> : messages.length === 0 ? <p className="feedback-empty">Aucun message pour le moment.</p> : messages.map((item) => <button key={item.id} type="button" className={`${selectedId === item.id ? "active " : ""}${item.readAt ? "read" : "unread"}`} onClick={() => void openMessage(item)}><span className={`feedback-kind-dot ${item.kind}`} aria-hidden="true" /><span><strong>{KIND_COPY[item.kind].label}{item.resolvedAt ? " · Résolu" : ""}</strong><small>{item.anonymous ? "Anonyme" : item.authorName || "Utilisateur"} · {new Date(item.createdAt).toLocaleDateString("fr-FR")}</small><em>{item.message}</em></span></button>)}
            </div>
            <article className="feedback-message-detail">
              {selected ? <>
                <div className="feedback-detail-meta"><span>{KIND_COPY[selected.kind].label}</span><time>{new Date(selected.createdAt).toLocaleString("fr-FR")}</time></div>
                <h3>{selected.anonymous ? "Message anonyme" : selected.authorName || "Collègue"}</h3>
                <p>{selected.message}</p>
                {selected.hasPhoto ? <img src={feedbackPhotoUrl(selected.id)} alt="Photo jointe au message" /> : null}
                {selected.adminReplies?.length ? <section className="feedback-sent-replies" aria-label="Réponses déjà envoyées"><strong>Réponses envoyées</strong>{selected.adminReplies.map((reply) => <p key={reply.id}>{reply.message}<time>{new Date(reply.sentAt).toLocaleString("fr-FR")}</time></p>)}</section> : null}
                <label className="feedback-reply-field"><span>Réponse personnalisée</span><textarea value={replyMessage} onChange={(event) => setReplyMessage(event.target.value.slice(0, 800))} rows={3} maxLength={800} placeholder="Écrivez le message qui apparaîtra sur son compte…" /><small>{replyMessage.length} / 800</small></label>
                <footer className="feedback-admin-actions">
                  {selected.resolvedAt ? <strong className="feedback-resolved-label">✓ Résolu</strong> : <button className="feedback-resolve-button" type="button" disabled={busy} onClick={() => void resolveSelected()}>{busy ? "Enregistrement…" : "Marquer comme résolu"}</button>}
                  <button className="feedback-reply-button" type="button" disabled={busy || replyMessage.trim().length < 2} onClick={() => void sendReply()}>{busy ? "Enregistrement…" : "Envoyer la réponse"}</button>
                  <button className="feedback-delete-button" type="button" disabled={busy} onClick={() => void deleteSelected()}>Effacer</button>
                </footer>
              </> : <div className="feedback-detail-placeholder"><span aria-hidden="true">◇</span><p>Sélectionnez un message pour le consulter.</p></div>}
            </article>
          </div>
        </>)}
        {isAdmin && error ? <p className="feedback-error inbox-error" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
