import "./absenceFormReminder.css";

/** Les demandes d'absence du dossier SAP que le formulaire de l'appli sait
 *  remplir, reconnues à leur nom (les deux dernières sont ajoutées par
 *  l'administrateur) : la feuille à ouvrir, et comment la nommer. L'annulation
 *  passe avant les congés, dont elle reprend le mot. */
const ABSENCE_FORMS = [
  { sheet: "annul", match: /annulation/, name: "la demande d’annulation", pronoun: "la" },
  { sheet: "echange", match: /echange/, name: "la demande d’échange", pronoun: "la" },
  { sheet: "ferie", match: /ferie/, name: "le remplacement de jour férié", pronoun: "le" },
  { sheet: "recup", match: /recup/, name: "la demande de récupérations", pronoun: "la" },
  { sheet: "conges", match: /conge/, name: "la demande de congés", pronoun: "la" },
] as const;

export type AbsenceForm = (typeof ABSENCE_FORMS)[number];

/** La feuille du formulaire qui correspond à un document, d'après son titre ;
 *  `null` pour un document que le formulaire ne remplit pas. */
export function absenceFormFor(title: string): AbsenceForm | null {
  const plain = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return ABSENCE_FORMS.find((form) => form.match.test(plain)) ?? null;
}

/** Une demande transmise par le planning attend le formulaire : comme
 *  « Formulaire vierge » (usePlanningRequestActions), on l'oublie pour que la
 *  feuille demandée s'ouvre vide. Même clé que HANDOFF_KEY dans App.tsx. */
function forgetPlanningHandoff() {
  try {
    localStorage.removeItem("planning:form-handoff-v1");
  } catch {}
}

type AbsenceFormReminderProps = {
  title: string;
  form: AbsenceForm;
  /** Hors connexion sécurisée, le PDF s'ouvre dans le lecteur au lieu de se télécharger. */
  previewOnly?: boolean;
  onDownload: () => void;
  onClose: () => void;
};

/** Avant de télécharger une demande d'absence : le formulaire de l'appli,
 *  qui la remplit à l'écran, d'abord ; le PDF vierge reste à un toucher. */
export function AbsenceFormReminder({ title, form, previewOnly = false, onDownload, onClose }: AbsenceFormReminderProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="modal-card absence-form-reminder"
        role="dialog"
        aria-modal="true"
        aria-labelledby="absence-form-reminder-title"
        aria-describedby="absence-form-reminder-text"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        <span className="absence-form-reminder-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /><path d="m9 17 .6-2.4 5.1-5.1 1.8 1.8-5.1 5.1z" /></svg>
        </span>
        <span className="step-label">{title}</span>
        <h2 id="absence-form-reminder-title">Et si vous {form.pronoun} remplissiez dans l’appli ?</h2>
        <p id="absence-form-reminder-text">
          Pas besoin d’imprimer : vous {form.pronoun} remplissez à l’écran, avec vos nom, groupe et signature, et le PDF est prêt à envoyer.
        </p>
        <div className="absence-form-reminder-actions">
          <a href={`/formulaire/index.html?feuille=${form.sheet}`} onClick={forgetPlanningHandoff}>
            <strong>Remplir dans l’appli</strong>
            <small>Le formulaire s’ouvre sur {form.name}</small>
          </a>
          <button type="button" onClick={onDownload}>
            <strong>{previewOnly ? "Ouvrir le PDF vierge" : "Télécharger le PDF vierge"}</strong>
            <small>À imprimer et remplir à la main</small>
          </button>
        </div>
      </section>
    </div>
  );
}
