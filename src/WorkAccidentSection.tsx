import { useEffect, useMemo, useState } from "react";
import type { LeavePeriod, PayStatus } from "./appModel";
import { fromKey, longDate } from "./planningLogic";

type WorkAccidentSectionProps = {
  initialStatus: PayStatus;
  periods: LeavePeriod[];
  onSave: (period: { from: string; to: string }) => Promise<boolean>;
  onDelete: (period: LeavePeriod) => Promise<boolean>;
  onBack: () => void;
};

const DOCUMENTS = {
  fonctionnaire: [
    ["Déclaration d’accident de service ou de trajet", "/useful-forms/declaration-accident-fonctionnaire.pdf"],
    ["Procédure fonctionnaire", "/useful-forms/procedure-accident-fonctionnaire.pdf"],
  ],
  contractuel: [
    ["Déclaration d’accident de travail ou de trajet", "/useful-forms/declaration-accident-contractuel.pdf"],
    ["Procédure contractuel", "/useful-forms/procedure-accident-contractuel.pdf"],
  ],
} as const;

const CONTACTS = [
  { label: "Prévenir les secouristes sur site ou à défaut les urgences", detail: "18 ou 15 · SMS 114 si sourd ou malentendant", href: "tel:18", action: "Appeler le 18" },
  { label: "Service médical de prévention", detail: "Déclaration et certificat médical", href: "mailto:servicemedical@centrepompidou.fr", action: "servicemedical@centrepompidou.fr" },
  { label: "DRH", detail: "Arrêt de travail dans les 48 heures", href: "mailto:drh@centrepompidou.fr", action: "drh@centrepompidou.fr" },
  { label: "Médecin du travail", detail: "Arrêt de plus de 30 jours ou besoin d’un avis", href: "tel:+33144784986", action: "01 44 78 49 86" },
] as const;

export function WorkAccidentSection({
  initialStatus,
  periods,
  onSave,
  onDelete,
  onBack,
}: WorkAccidentSectionProps) {
  const [status, setStatus] = useState<PayStatus>(initialStatus);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  const accidents = useMemo(
    () => periods.filter((period) => period.leaveType === "work_accident").sort((a, b) => b.from.localeCompare(a.from)),
    [periods],
  );

  const save = async () => {
    setSaving(true);
    try {
      if (await onSave({ from, to: to || from })) {
        setFrom("");
        setTo("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="work-accident-screen" aria-labelledby="work-accident-title">
      <header className="work-accident-header">
        <button type="button" className="native-back-button section-back-hit-area" onClick={onBack} aria-label="Revenir aux formulaires utiles"><span className="section-back-arrow" aria-hidden="true">←</span></button>
        <div>
          <span className="step-label">Formulaires utiles</span>
          <h2 id="work-accident-title">Déclarer un accident de travail</h2>
          <p>Accident de service, de travail ou de trajet.</p>
        </div>
      </header>

      <div className="work-accident-status" role="group" aria-label="Votre statut">
        <button type="button" className={status === "contractuel" ? "active" : ""} onClick={() => setStatus("contractuel")}>Contractuel</button>
        <button type="button" className={status === "fonctionnaire" ? "active" : ""} onClick={() => setStatus("fonctionnaire")}>Fonctionnaire</button>
      </div>

      <section className="work-accident-card work-accident-primary-documents">
        <h3>Documents à utiliser</h3>
        <div className="work-accident-documents">
          {DOCUMENTS[status].map(([title, href]) => (
            <a key={href} href={href} download><span>PDF</span><strong>{title}</strong><b>Télécharger</b></a>
          ))}
        </div>
      </section>

      <section className="work-accident-urgent" aria-labelledby="work-accident-urgent-title">
        <h3 id="work-accident-urgent-title">À faire immédiatement</h3>
        <ol>
          <li><strong>Mettez-vous en sécurité et faites organiser les premiers soins.</strong></li>
          <li>Prévenez votre supérieur hiérarchique dans la journée, au plus tard le lendemain.</li>
          <li>Consultez rapidement un médecin pour faire constater précisément les lésions.</li>
        </ol>
      </section>

      <div className="work-accident-columns">
        <section className="work-accident-card">
          <h3>{status === "fonctionnaire" ? "Parcours fonctionnaire" : "Parcours contractuel"}</h3>
          {status === "fonctionnaire" ? (
            <ul>
              <li>Envoyez la déclaration et le certificat médical au service médical de prévention. Le délai réglementaire de déclaration est de <strong>15 jours</strong> après l’accident.</li>
              <li>Si un arrêt est prescrit, transmettez-le à la DRH dans les <strong>48 heures</strong> suivant son établissement.</li>
              <li>Si l’accident est reconnu comme lié au service et qu’un arrêt vous empêche de travailler, l’administration vous place en CITIS : c’est votre congé pendant la période d’arrêt.</li>
            </ul>
          ) : (
            <ul>
              <li>Prévenez l’employeur dans les <strong>24 heures</strong> et utilisez la feuille de prise en charge disponible dans l’application, à présenter aux professionnels de santé.</li>
              <li>Envoyez les volets 1 et 2 du certificat médical initial à la CPAM si le médecin ne les télétransmet pas ; conservez le volet 3.</li>
              <li>Transmettez l’arrêt à la DRH dans les <strong>48 heures</strong>. L’employeur déclare l’accident à la CPAM dans les 48 heures, hors dimanches et jours fériés.</li>
            </ul>
          )}
        </section>

        <section className="work-accident-card work-accident-rights">
          <h3>Carence, salaire et frais</h3>
          <p className="work-accident-no-carence"><strong>Aucun jour de carence</strong> pour un accident reconnu comme professionnel.</p>
          {status === "fonctionnaire" ? (
            <div className="work-accident-rights-copy">
              <p><strong>CITIS</strong> signifie « congé pour invalidité temporaire imputable au service ». Il concerne le fonctionnaire lorsque l’administration reconnaît que l’accident est lié au service et qu’un arrêt l’empêche de travailler.</p>
              <p>Pendant ce congé, vous conservez l’intégralité de votre traitement. Conservez les factures et justificatifs : l’administration prend en charge les soins et frais directement liés à l’accident reconnu.</p>
            </div>
          ) : (
            <p>La feuille d’accident permet la prise en charge à 100 % des soins liés, sans avance de frais, dans la limite des tarifs de l’Assurance Maladie. Les dépassements d’honoraires restent à votre charge.</p>
          )}
          <p className="work-accident-caution">La qualification et la prise en charge restent soumises à la décision de l’administration ou de la CPAM.</p>
        </section>
      </div>

      <section className="work-accident-card">
        <h3>Éléments à préparer</h3>
        <ul className="work-accident-checklist">
          <li>Date, heure, horaires de travail et lieu précis</li>
          <li>Activité réalisée, circonstances et objet à l’origine de la blessure</li>
          <li>Identité des témoins ou de la première personne informée</li>
          <li>Identité et assurance d’un tiers éventuellement impliqué</li>
          <li>Certificat médical initial décrivant la nature et le siège des lésions</li>
          <li>Pour un accident de trajet : plan de l’itinéraire et justificatifs utiles</li>
        </ul>
      </section>

      <section className="work-accident-card">
        <h3>Personnes et services à prévenir</h3>
        <div className="work-accident-contacts">
          {CONTACTS.map((contact) => (
            <a key={contact.label} href={contact.href}>
              <span><strong>{contact.label}</strong><small>{contact.detail}</small></span>
              <b className={`work-accident-contact-action ${contact.href.startsWith("mailto:") ? "email" : "phone"}`}>{contact.action}</b>
            </a>
          ))}
        </div>
      </section>

      <section className="work-accident-card work-accident-planning">
        <div>
          <h3>Ajouter au planning</h3>
        </div>
        <div className="work-accident-date-fields">
          <label>Date de l’accident ou premier jour<span className={`work-accident-date-input${from ? " has-value" : ""}`}><input type="date" value={from} placeholder="jj/mm/aaaa" onChange={(event) => { setFrom(event.target.value); if (!to) setTo(event.target.value); }} /><span aria-hidden="true">jj/mm/aaaa</span></span></label>
          <label>Dernier jour concerné<span className={`work-accident-date-input${to ? " has-value" : ""}`}><input type="date" value={to} min={from || undefined} placeholder="jj/mm/aaaa" onChange={(event) => setTo(event.target.value)} /><span aria-hidden="true">jj/mm/aaaa</span></span></label>
        </div>
        <button className="work-accident-save" type="button" disabled={!from || saving} onClick={() => void save()}>{saving ? "Enregistrement…" : "Marquer ces dates dans le planning"}</button>
        {accidents.length ? (
          <div className="work-accident-records">
            <h4>Périodes enregistrées</h4>
            {accidents.map((period) => (
              <div key={period.id}>
                <span>{longDate(fromKey(period.from))}{period.to !== period.from ? ` au ${longDate(fromKey(period.to))}` : ""}</span>
                <button type="button" disabled={deletingId === period.id} onClick={() => { setDeletingId(period.id); void onDelete(period).finally(() => setDeletingId("")); }}>{deletingId === period.id ? "Retrait…" : "Retirer"}</button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <footer className="work-accident-sources">
        <strong>Informations vérifiées le 30 août 2026</strong>
        <a href="https://www.service-public.fr/particuliers/vosdroits/R53535" target="_blank" rel="noreferrer">Déclaration fonctionnaire · Service-Public.fr</a>
        <a href="https://www.fonction-publique.gouv.fr/etre-agent-public/ma-protection-sociale/accidents-et-maladies-professionnelles" target="_blank" rel="noreferrer">CITIS · Fonction publique</a>
        <a href="https://www.ameli.fr/assure/droits-demarches/maladie-accident-hospitalisation/accident-travail-trajet" target="_blank" rel="noreferrer">Démarches et frais · ameli.fr</a>
      </footer>
    </section>
  );
}
