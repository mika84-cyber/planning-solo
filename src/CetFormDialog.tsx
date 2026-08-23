import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type CetFormKind = "opening" | "funding";

type CetFormDialogProps = {
  kind: CetFormKind | null;
  fullName: string;
  signature: string;
  year: number;
  annualBalance: number;
  rttBalance: number;
  depositDays: number;
  balanceBefore: number;
  onClose: () => void;
};

const RECIPIENT = "clothilde.letourneur@centrepompidou.fr";
const DIRECTION = "Direction des publics - Service de l'accueil des publics";

function splitName(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { firstName: words[0] || "", lastName: "" };
  return { firstName: words[0], lastName: words.slice(1).join(" ") };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function CetFormDialog({
  kind,
  fullName,
  signature,
  year,
  annualBalance,
  rttBalance,
  depositDays,
  balanceBefore,
  onClose,
}: CetFormDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [groupCategory, setGroupCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [annual, setAnnual] = useState(annualBalance);
  const [rtt, setRtt] = useState(rttBalance);
  const [deposit, setDeposit] = useState(depositDays);
  const [keep, setKeep] = useState(balanceBefore + depositDays);
  const [indemnify, setIndemnify] = useState(0);
  const [formSignature, setFormSignature] = useState(signature);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [helpVisible, setHelpVisible] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signingRef = useRef(false);

  useEffect(() => {
    if (!kind) return;
    const name = splitName(fullName);
    setFirstName(name.firstName);
    setLastName(name.lastName);
    setAnnual(annualBalance);
    setRtt(rttBalance);
    setDeposit(depositDays);
    setKeep(balanceBefore + depositDays);
    setIndemnify(0);
    setGroupCategory("");
    setFormSignature(signature);
    setError("");
    setHelpVisible(false);
  }, [kind, fullName, signature, annualBalance, rttBalance, depositDays, balanceBefore]);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !kind) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!signature?.startsWith("data:image/")) return;
    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * ratio;
      const height = image.height * ratio;
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    };
    image.src = signature;
  }, [kind, signature]);

  if (!kind) return null;
  const totalCet = balanceBefore + deposit;
  const subject = kind === "opening"
    ? "Demande d’ouverture de mon CET"
    : `Alimentation et ventilation de mon CET ${year}`;

  async function createPdf() {
    if (!firstName.trim() || !lastName.trim() || !groupCategory || !date) {
      setError("Complétez le nom, le prénom, le groupe ou la catégorie et la date.");
      return;
    }
    if (kind === "funding") {
      const values = [annual, rtt, deposit, balanceBefore, keep, indemnify];
      if (values.some((value) => !Number.isInteger(value) || value < 0)) {
        setError("Le formulaire CET accepte uniquement des nombres entiers positifs.");
        return;
      }
      if (deposit > annual + rtt) {
        setError("Le nombre de jours versés dépasse le solde CA + RTT indiqué.");
        return;
      }
      if (keep + indemnify !== totalCet) {
        setError(`La conservation et l’indemnisation doivent répartir les ${totalCet} jours du CET.`);
        return;
      }
      if (indemnify > Math.max(0, totalCet - 15)) {
        setError("Les 15 premiers jours ne peuvent pas être indemnisés.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const { createCetFundingPdf, createCetOpeningPdf } = await import("./cetFormsPdf");
      const identity = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        service: DIRECTION,
        groupCategory,
        date,
        signature: formSignature,
      };
      const file = kind === "opening"
        ? await createCetOpeningPdf(identity)
        : await createCetFundingPdf({
            ...identity,
            year,
            annualBalance: annual,
            rttBalance: rtt,
            depositDays: deposit,
            balanceBefore,
            keepDays: keep,
            indemnifyDays: indemnify,
          });
      download(file.blob, file.filename);
    } catch {
      setError("Le PDF n’a pas pu être préparé. Rechargez la page puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function signaturePoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  }

  function beginSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = signatureCanvasRef.current?.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = signaturePoint(event);
    signingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#101820";
  }

  function drawSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!signingRef.current) return;
    const context = signatureCanvasRef.current?.getContext("2d");
    if (!context) return;
    const point = signaturePoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function finishSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!signingRef.current) return;
    signingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const source = event.currentTarget;
    const context = source.getContext("2d");
    if (!context) return;
    const pixels = context.getImageData(0, 0, source.width, source.height);
    let left = source.width;
    let right = -1;
    let top = source.height;
    let bottom = -1;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        if (pixels.data[(y * source.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) {
      setFormSignature("");
      return;
    }
    const padding = 12;
    const trimmed = document.createElement("canvas");
    trimmed.width = right - left + 1 + padding * 2;
    trimmed.height = bottom - top + 1 + padding * 2;
    trimmed
      .getContext("2d")
      ?.drawImage(
        source,
        left,
        top,
        right - left + 1,
        bottom - top + 1,
        padding,
        padding,
        right - left + 1,
        bottom - top + 1,
      );
    setFormSignature(trimmed.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setFormSignature("");
  }

  return (
    <div className="modal-backdrop cet-form-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card cet-form-modal" role="dialog" aria-modal="true" aria-labelledby="cet-form-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        <span className="step-label">Formulaire officiel Centre Pompidou</span>
        <h2 id="cet-form-title">{kind === "opening" ? "Ouvrir mon compte épargne-temps" : "Alimenter ou indemniser mon CET"}</h2>
        <p>Remplissez les champs ci-dessous : l’application les reporte sur le formulaire officiel d’origine.</p>
        {kind === "funding" ? (
          <>
            <p className="cet-form-availability" role="alert">
              <strong>Attention :</strong> vous pouvez préparer ce formulaire maintenant, mais il ne peut être envoyé qu’entre le 15 novembre et le 31 décembre.
            </p>
            <button
              className="cet-form-help-button"
              type="button"
              aria-expanded={helpVisible}
              aria-controls="cet-form-help"
              onClick={() => setHelpVisible(true)}
            >
              Aide au remplissage
            </button>
            {helpVisible ? (
              <section id="cet-form-help" className="cet-form-help" aria-labelledby="cet-form-help-title">
                <div className="cet-form-help-heading">
                  <h3 id="cet-form-help-title">Que faut-il inscrire ?</h3>
                  <button type="button" onClick={() => setHelpVisible(false)}>Fermer l’aide</button>
                </div>
                <dl>
                  <div><dt>Solde CA + fractionnement</dt><dd>Vos congés annuels et jours de fractionnement encore disponibles.</dd></div>
                  <div><dt>Solde RTT</dt><dd>Vos jours de RTT encore disponibles.</dd></div>
                  <div><dt>Jours à verser</dt><dd>Les jours entiers que vous ajoutez cette année à votre CET.</dd></div>
                  <div><dt>Solde CET avant alimentation</dt><dd>Le solde déjà présent sur votre CET avant ce nouveau versement.</dd></div>
                  <div><dt>Jours à conserver</dt><dd>Les jours du total après alimentation que vous gardez sur le CET pour les prendre plus tard en congés.</dd></div>
                  <div><dt>Jours à indemniser</dt><dd>La part au-delà des 15 premiers jours que vous demandez à faire payer.</dd></div>
                </dl>
                <p className="cet-form-help-total"><strong>À vérifier :</strong> jours conservés + jours indemnisés = total après alimentation.</p>
              </section>
            ) : null}
          </>
        ) : null}

        <div className="cet-form-fields">
          <label><span>Nom</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" /></label>
          <label><span>Prénom</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" /></label>
          <label className="wide"><span>Direction, service, pôle ou cellule</span><input value={DIRECTION} readOnly /></label>
          <label>
            <span>Groupe / catégorie</span>
            <select value={groupCategory} onChange={(event) => setGroupCategory(event.target.value)}>
              <option value="">Sélectionner…</option>
              <option value="Groupe 1">Groupe 1</option>
              <option value="Catégorie C">Catégorie C</option>
            </select>
          </label>
          <label><span>Date de la demande</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>

        {kind === "funding" ? (
          <section className="cet-form-numbers">
            <h3>Alimentation et ventilation {year}</h3>
            <div>
              <label><span>Solde CA + fractionnement</span><input type="number" min="0" step="1" value={annual} onChange={(event) => setAnnual(Number(event.target.value))} /></label>
              <label><span>Solde RTT</span><input type="number" min="0" step="1" value={rtt} onChange={(event) => setRtt(Number(event.target.value))} /></label>
              <label><span>Jours à verser</span><input type="number" min="0" step="1" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} /></label>
              <label><span>Solde CET avant alimentation</span><input value={balanceBefore} readOnly /></label>
              <label><span>Jours à conserver sur le CET</span><input type="number" min="0" step="1" value={keep} onChange={(event) => setKeep(Number(event.target.value))} /></label>
              <label><span>Jours à indemniser (83 € bruts/jour)</span><input type="number" min="0" step="1" value={indemnify} onChange={(event) => setIndemnify(Number(event.target.value))} /></label>
            </div>
            <p>Total après alimentation : <strong>{totalCet} jours</strong>. Conservation + indemnisation doit être égal à ce total.</p>
          </section>
        ) : null}

        <section className="cet-signature-field">
          <div>
            <h3>Signature de l’agent</h3>
            <p>Signez avec le doigt ou la souris. La signature sera placée directement dans le formulaire PDF.</p>
          </div>
          <canvas
            ref={signatureCanvasRef}
            width="720"
            height="180"
            aria-label="Zone de signature"
            onPointerDown={beginSignature}
            onPointerMove={drawSignature}
            onPointerUp={finishSignature}
            onPointerCancel={finishSignature}
          />
          <button type="button" onClick={clearSignature}>Effacer la signature</button>
        </section>

        <aside className="cet-recipient">
          <strong>À envoyer à Clothilde Letourneur</strong>
          <a href={`mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}`}>{RECIPIENT}</a>
          <small>Téléchargez d’abord le PDF, puis joignez-le au courriel. Une pièce jointe ne peut pas être ajoutée automatiquement par le navigateur.</small>
        </aside>
        {error ? <p className="cet-error" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
          <button className="save-button" type="button" disabled={busy} onClick={() => void createPdf()}>{busy ? "Préparation…" : "Télécharger le formulaire rempli"}</button>
        </div>
      </section>
    </div>
  );
}
