import { useEffect, useId, useRef, useState } from "react";
import { createPayslipLetterPdf, DEFAULT_LETTER_RECIPIENT, letterParagraphs, payslipLetter, payslipLetterPdfName } from "./payslipGapLetter";
import type { PayslipGapRecord } from "./payslipVerificationRecords";
import "./payslipGap.css";

function downloadPdf(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Ce que la personne a écrit dans la fenêtre : gardé avec l'anomalie. */
export type PayslipLetterDraft = {
  recipient: string;
  message: string;
  /** L'objet et le texte réécrits ; vides, ceux que l'application propose. */
  subject: string;
  body: string;
};

/**
 * « Écrire à ma hiérarchie » : le destinataire et un mot facultatif, puis le
 * courrier tel qu'il partira — daté, l'écart expliqué, le détail attendu /
 * bulletin sous la signature. « Modifier le texte » ouvre l'objet et le
 * texte à la réécriture ; « Revenir au texte proposé » les rend. Il se
 * télécharge en PDF ou s'envoie par e-mail ; sur téléphone, le partage
 * propose aussi les messageries.
 */
export function PayslipLetterSheet({
  gap,
  year,
  month,
  fullName,
  signatureImage,
  recipient: initialRecipient,
  message: initialMessage,
  subject: initialSubject,
  body: initialBody,
  today = new Date(),
  onSave,
  onClose,
}: {
  gap: PayslipGapRecord;
  year: number;
  month: number;
  fullName: string;
  signatureImage?: string;
  recipient?: string;
  message?: string;
  subject?: string;
  body?: string;
  today?: Date;
  /** Garde ce qui a été écrit avec l'anomalie signalée. */
  onSave: (draft: PayslipLetterDraft) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hintId = useId();
  const [recipient, setRecipient] = useState(initialRecipient || DEFAULT_LETTER_RECIPIENT);
  const [message, setMessage] = useState(initialMessage || "");
  const [name, setName] = useState(fullName);
  const [subject, setSubject] = useState(initialSubject || "");
  const [body, setBody] = useState(initialBody || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal?.();
  }, []);
  const proposed = payslipLetter({ gap, year, month, date: today, recipient, message, fullName: name });
  // Le texte réécrit remplace celui proposé, mot compris ; identique, il
  // n'est pas gardé.
  const ownSubject = subject.trim() && subject.trim() !== proposed.subject ? subject.trim() : "";
  const ownBody = body.trim() && body.trim() !== proposed.body ? body.trim() : "";
  const letter = payslipLetter({ gap, year, month, date: today, recipient, message, fullName: name, subject: ownSubject, body: ownBody });
  const rewritten = Boolean(ownSubject || ownBody);
  const draft = { recipient, message, subject: ownSubject, body: ownBody };
  const changed = recipient !== (initialRecipient || DEFAULT_LETTER_RECIPIENT) || message !== (initialMessage || "") ||
    draft.subject !== (initialSubject || "") || draft.body !== (initialBody || "");
  const close = () => {
    if (changed) onSave(draft);
    onClose();
  };
  const startEditing = () => {
    // On part du courrier tel qu'il s'affiche.
    setSubject(letter.subject);
    setBody(letter.body);
    setEditing(true);
  };
  const restoreProposed = () => {
    setSubject("");
    setBody("");
    setEditing(false);
  };
  const run = async (channel: "pdf" | "email") => {
    setBusy(true);
    setError("");
    onSave(draft);
    try {
      const blob = await createPayslipLetterPdf(letter, signatureImage);
      const fileName = payslipLetterPdfName(year, month);
      if (channel === "pdf") {
        downloadPdf(blob, fileName);
        return;
      }
      const file = new File([blob], fileName, { type: "application/pdf" });
      const title = letter.subject.replace(/^Objet : /, "");
      const shareData = { title, text: `Madame, Monsieur,\n\nVeuillez trouver ci-joint mon courrier concernant mon bulletin de paie.\n\n${letter.signature}`, files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadPdf(blob, fileName);
        const text = [letter.body, letter.signature].filter(Boolean).join("\n\n");
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n(Le courrier en PDF vient d’être téléchargé : ajoutez-le au message.)`)}`;
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(channel === "pdf" ? "Le PDF du courrier n’a pas pu être créé." : "L’envoi n’a pas pu s’ouvrir. Téléchargez le PDF et joignez-le à un e-mail.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialogRef}
      className="payslip-letter-sheet"
      aria-label="Écrire à ma hiérarchie"
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="payslip-letter-panel">
        <span className="payslip-letter-grip" aria-hidden="true" />
        <header className="payslip-letter-head">
          <h2>Écrire à ma hiérarchie</h2>
          <button type="button" className="payslip-letter-close" aria-label="Fermer" onClick={close}>×</button>
        </header>
        <label className="payslip-letter-field">
          <span>Destinataire</span>
          <input value={recipient} maxLength={200} onChange={(event) => setRecipient(event.target.value)} />
        </label>
        {fullName ? null : (
          <label className="payslip-letter-field">
            <span>Votre nom, pour signer</span>
            <input value={name} maxLength={120} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </label>
        )}
        {rewritten ? null : (
          <label className="payslip-letter-field">
            <span>Un mot de votre part (facultatif)</span>
            <textarea value={message} rows={2} maxLength={1000} placeholder="Ajoutez une précision si besoin…" onChange={(event) => setMessage(event.target.value)} />
          </label>
        )}
        {editing ? (
          <section className="payslip-letter-editor" aria-label="Réécriture du courrier">
            <label className="payslip-letter-field">
              <span>Objet</span>
              <input value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label className="payslip-letter-field">
              <span>Texte du courrier</span>
              <textarea value={body} rows={16} maxLength={6000} aria-describedby={hintId} onChange={(event) => setBody(event.target.value)} />
            </label>
            <small id={hintId} className="payslip-letter-hint">Une ligne vide sépare deux paragraphes. Le détail de l’écart reste sous la signature.</small>
            <div className="payslip-letter-edit-actions">
              <button type="button" className="primary" onClick={() => setEditing(false)}>Voir le courrier</button>
              <button type="button" onClick={restoreProposed}>Revenir au texte proposé</button>
            </div>
          </section>
        ) : (
          <>
            <article className="payslip-letter-paper" aria-label="Aperçu du courrier">
              {letter.signature ? <p className="from">{letter.signature}</p> : null}
              <p className="to">{letter.recipient}</p>
              <p className="place">{letter.place}</p>
              <p className="subject">{letter.subject}</p>
              {letterParagraphs(letter.body).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {signatureImage?.startsWith("data:image/") ? <img className="sign-image" src={signatureImage} alt="Signature" /> : null}
              {letter.signature ? <p className="sign">{letter.signature}</p> : null}
              {letter.table.length ? (
                <table>
                  <caption>Détail de l’écart</caption>
                  <thead><tr><th scope="col">Ligne</th><th scope="col">Attendu</th><th scope="col">Bulletin</th></tr></thead>
                  <tbody>
                    {letter.table.map((row) => (
                      <tr key={row.label}><th scope="row">{row.label}</th><td>{row.expected}</td><td>{row.found}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </article>
            <div className="payslip-letter-edit-actions">
              <button type="button" onClick={startEditing}>Modifier le texte</button>
              {rewritten ? <button type="button" onClick={restoreProposed}>Revenir au texte proposé</button> : null}
            </div>
          </>
        )}
        {error ? <p className="payslip-letter-error" role="alert">{error}</p> : null}
        <div className="payslip-letter-actions">
          <button type="button" className="primary" disabled={busy || editing} onClick={() => void run("pdf")}>Télécharger le PDF</button>
          <button type="button" disabled={busy || editing} onClick={() => void run("email")}>Envoyer par e-mail</button>
        </div>
      </div>
    </dialog>
  );
}
