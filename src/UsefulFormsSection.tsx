import { useState, type MouseEvent } from "react";

export type UsefulFormsFolderKey = "expo" | "sap" | "brantome";

type UsefulFormDocument = {
  title: string;
  file: string;
  format: "PDF" | "DOCX";
};

type UsefulFormsFolder = {
  key: UsefulFormsFolderKey;
  title: string;
  description: string;
  documents: UsefulFormDocument[];
};

export function getUsefulFormAction(format: UsefulFormDocument["format"], secureContext: boolean) {
  return !secureContext && format === "PDF" ? "preview" : "download";
}

export const USEFUL_FORM_FOLDERS: UsefulFormsFolder[] = [
  {
    key: "expo",
    title: "Formulaire Expo",
    description: "Les formulaires Expo seront ajoutés ici.",
    documents: [],
  },
  {
    key: "sap",
    title: "Formulaire SAP",
    description: "Congés, récupérations et annulations.",
    documents: [
      { title: "Demande de congés", file: "demande-conges.pdf", format: "PDF" },
      { title: "Demande de récupérations", file: "demande-recuperations.pdf", format: "PDF" },
      { title: "Demande d’annulation de congés", file: "demande-annulation-conges.pdf", format: "PDF" },
    ],
  },
  {
    key: "brantome",
    title: "Formulaire Brantôme",
    description: "Coordonnées, cartes, restauration et CET.",
    documents: [
      { title: "Formulaire de changement de coordonnées", file: "formulaire-changement-coordonnees.pdf", format: "PDF" },
      { title: "Changement de coordonnées bancaires", file: "changement-coordonnees-bancaires.docx", format: "DOCX" },
      { title: "Demande de carte de restauration BIMPLI", file: "demande-carte-restauration-bimpli.pdf", format: "PDF" },
      { title: "Procuration pour le retrait des titres-restaurant", file: "procuration-retrait-titres-repas.pdf", format: "PDF" },
      { title: "Demande de Carte Culture A", file: "demande-carte-culture-a.pdf", format: "PDF" },
      { title: "CET - Demande d’ouverture", file: "cet-demande-ouverture.pdf", format: "PDF" },
      { title: "CET - Alimentation et indemnisation", file: "cet-alimentation-indemnisation.pdf", format: "PDF" },
    ],
  },
];

function documentCount(count: number) {
  if (!count) return "Vide pour le moment";
  return `${count} document${count > 1 ? "s" : ""}`;
}

export function UsefulFormsSection() {
  const [activeFolder, setActiveFolder] = useState<UsefulFormsFolderKey | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const folder = USEFUL_FORM_FOLDERS.find((item) => item.key === activeFolder);
  const secureContext = typeof window === "undefined" || window.isSecureContext;

  const downloadForm = async (
    event: MouseEvent<HTMLAnchorElement>,
    file: string,
    action: "preview" | "download",
  ) => {
    event.preventDefault();

    if (action === "preview") {
      window.open(event.currentTarget.href, "_blank", "noopener");
      return;
    }

    setDownloadingFile(file);
    setDownloadError("");

    try {
      const response = await fetch(event.currentTarget.href, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Téléchargement impossible (${response.status})`);

      const objectUrl = URL.createObjectURL(await response.blob());
      const downloadLink = window.document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = file;
      downloadLink.rel = "noopener";
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      setDownloadError("Le téléchargement n’a pas pu démarrer. Vérifiez votre connexion puis réessayez.");
    } finally {
      setDownloadingFile(null);
    }
  };

  if (folder) {
    return (
      <section className="useful-forms-screen useful-forms-folder-screen" aria-labelledby="useful-forms-folder-title">
        <header className={`useful-forms-folder-header tone-${folder.key}`}>
          <button
            className="native-back-button"
            type="button"
            onClick={() => setActiveFolder(null)}
            aria-label="Revenir aux dossiers de formulaires"
          >
            <span aria-hidden="true">←</span>
          </button>
          <div>
            <span className="step-label">Formulaires utiles</span>
            <h2 id="useful-forms-folder-title">{folder.title}</h2>
            <small>{documentCount(folder.documents.length)}</small>
          </div>
        </header>

        {folder.documents.length ? (
          <div className="useful-form-download-list">
            {!secureContext ? (
              <p className="useful-form-local-notice">
                Mode de test local : les PDF s’ouvrent dans le lecteur du navigateur. Utilisez ensuite son bouton Enregistrer. Le téléchargement direct sans alerte sera disponible sur la version sécurisée.
              </p>
            ) : null}
            {folder.documents.map((document, index) => {
              const action = getUsefulFormAction(document.format, secureContext);
              return (
              <article key={document.file} className="useful-form-download-card">
                <span className="useful-form-file-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 2h8l4 4v16H6z" />
                    <path d="M14 2v5h5M9 13h6M9 17h6" />
                  </svg>
                </span>
                <span className="useful-form-file-copy">
                  <small>{index + 1}. {document.format}</small>
                  <strong>{document.title}</strong>
                </span>
                <a
                  href={`/useful-forms/${document.file}`}
                  download
                  aria-label={`${action === "preview" ? "Ouvrir" : "Télécharger"} ${document.title}`}
                  aria-busy={downloadingFile === document.file}
                  onClick={(event) => void downloadForm(event, document.file, action)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v12m-4-4 4 4 4-4M5 19h14" />
                  </svg>
                  {downloadingFile === document.file
                    ? "Préparation…"
                    : action === "preview" ? "Ouvrir le PDF" : "Télécharger"}
                </a>
              </article>
              );
            })}
            {downloadError ? <p className="useful-form-download-error" role="alert">{downloadError}</p> : null}
          </div>
        ) : (
          <div className="useful-forms-empty">
            <span aria-hidden="true">＋</span>
            <strong>Aucun formulaire pour le moment</strong>
            <p>Ce dossier est prêt à recevoir les futurs formulaires Expo.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="useful-forms-screen" aria-labelledby="useful-forms-title">
      <div className="native-screen-heading">
        <span className="step-label">Documents pratiques</span>
        <h2 id="useful-forms-title">Formulaires utiles</h2>
        <p>Choisissez un dossier puis téléchargez directement le document dont vous avez besoin.</p>
      </div>
      <div className="useful-form-folder-grid">
        {USEFUL_FORM_FOLDERS.map((item) => (
          <button
            key={item.key}
            className={`useful-form-folder tone-${item.key}`}
            type="button"
            onClick={() => setActiveFolder(item.key)}
          >
            <span className="useful-form-folder-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 6h7l2 2h9v11H3z" />
              </svg>
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{documentCount(item.documents.length)}</small>
              <em>{item.description}</em>
            </span>
            <i aria-hidden="true">›</i>
          </button>
        ))}
      </div>
    </section>
  );
}
