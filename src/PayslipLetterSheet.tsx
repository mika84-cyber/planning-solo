import { useEffect, useRef, useState } from "react";
import { createPayslipLetterPdf, DEFAULT_LETTER_RECIPIENT, payslipLetter, payslipLetterPdfName } from "./payslipGapLetter";
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

/**
 * « Écrire à ma hiérarchie » : le destinataire et un mot facultatif, puis le
 * courrier tel qu'il partira — daté, l'écart expliqué, un tableau attendu /
 * bulletin. Il se télécharge en PDF ou s'envoie par e-mail ; sur téléphone,
 * le partage propose aussi les messageries.
 */
export function PayslipLetterSheet({
  gap,
  year,
  month,
  fullName,
  signatureImage,
  recipient: initialRecipient,
  message: initialMessage,
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
  today?: Date;
  /** Garde le destinataire et le mot avec l'anomalie signalée. */
  onSave: (recipient: string, message: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [recipient, setRecipient] = useState(initialRecipient || DEFAULT_LETTER_RECIPIENT);
  const [message, setMessage] = useState(initialMessage || "");
  const [name, setName] = useState(fullName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal?.();
  }, []);
  const letter = payslipLetter({ gap, year, month, date: today, recipient, message, fullName: name });
  const close = () => {
    if (recipient !== (initialRecipient || DEFAULT_LETTER_RECIPIENT) || message !== (initialMessage || "")) onSave(recipient, message);
    onClose();
  };
  const run = async (channel: "pdf" | "email") => {
    setBusy(true);
    setError("");
    onSave(recipient, message);
    try {
      const blob = await createPayslipLetterPdf(letter, signatureImage);
      const fileName = payslipLetterPdfName(year, month);
      if (channel === "pdf") {
        downloadPdf(blob, fileName);
        return;
      }
      const file = new File([blob], fileName, { type: "application/pdf" });
      const subject = letter.subject.replace(/^Objet : /, "");
      const shareData = { title: subject, text: `${letter.salutation}\n\nVeuillez trouver ci-joint mon courrier concernant mon bulletin de paie.\n\n${letter.signature}`, files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadPdf(blob, fileName);
        const body = [letter.salutation, ...letter.paragraphs, letter.request, letter.closing, letter.signature].filter(Boolean).join("\n\n");
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n(Le courrier en PDF vient d’être téléchargé : ajoutez-le au message.)`)}`;
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
        <label className="payslip-letter-field">
          <span>Un mot de votre part (facultatif)</span>
          <textarea value={message} rows={2} maxLength={1000} placeholder="Ajoutez une précision si besoin…" onChange={(event) => setMessage(event.target.value)} />
        </label>
        <article className="payslip-letter-paper" aria-label="Aperçu du courrier">
          {letter.signature ? <p className="from">{letter.signature}</p> : null}
          <p className="to">{letter.recipient}</p>
          <p className="place">{letter.place}</p>
          <p className="subject">{letter.subject}</p>
          <p>{letter.salutation}</p>
          {letter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {letter.table.length ? (
            <table>
              <thead><tr><th scope="col">Ligne</th><th scope="col">Attendu</th><th scope="col">Bulletin</th></tr></thead>
              <tbody>
                {letter.table.map((row) => (
                  <tr key={row.label}><th scope="row">{row.label}</th><td>{row.expected}</td><td>{row.found}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <p>{letter.request}</p>
          <p>{letter.closing}</p>
          {signatureImage?.startsWith("data:image/") ? <img className="sign-image" src={signatureImage} alt="Signature" /> : null}
          {letter.signature ? <p className="sign">{letter.signature}</p> : null}
        </article>
        {error ? <p className="payslip-letter-error" role="alert">{error}</p> : null}
        <div className="payslip-letter-actions">
          <button type="button" className="primary" disabled={busy} onClick={() => void run("pdf")}>Télécharger le PDF</button>
          <button type="button" disabled={busy} onClick={() => void run("email")}>Envoyer par e-mail</button>
        </div>
      </div>
    </dialog>
  );
}
