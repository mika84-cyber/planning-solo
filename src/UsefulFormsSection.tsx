import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import type { LeavePeriod, PayStatus } from "./appModel";
import { WorkAccidentIcon } from "./WorkAccidentIcon";
import {
  GRAND_PALAIS_PROGRAM,
  isGrandPalaisEntryVisible,
  type GrandPalaisProgramData,
} from "./GrandPalaisProgramSection";
import { readResourceFavorites, writeResourceFavorites } from "./resourceFavorites";
import "./usefulDocumentAdmin.css";
import {
  addSharedUsefulDocument,
  getSharedUsefulDocuments,
  type SharedUsefulDocument,
  type UsefulDocumentFolderKey,
} from "./usefulDocumentsApi";

const WorkAccidentSection = lazy(() => import("./WorkAccidentSection").then((module) => ({ default: module.WorkAccidentSection })));

export type UsefulFormsFolderKey = "expo" | "sap" | "brantome" | "tickets" | "work-accident";

type UsefulFormDocument = {
  title: string;
  file: string;
  format: "PDF" | "DOCX";
  programEntryTitle?: string;
  href?: string;
};

type UsefulFormsFolder = {
  key: UsefulFormsFolderKey;
  title: string;
  description: string;
  documents: UsefulFormDocument[];
  image?: { src: string; alt: string };
};

export function getUsefulFormAction(format: UsefulFormDocument["format"], secureContext: boolean) {
  return !secureContext && format === "PDF" ? "preview" : "download";
}

export const USEFUL_FORM_FOLDERS: UsefulFormsFolder[] = [
  {
    key: "expo",
    title: "Formulaire Expo",
    description: "Consignes et documents d’exposition.",
    documents: [
      {
        title: "Hilma Af Klint",
        file: "hilma-af-klint.pdf",
        format: "PDF",
        programEntryTitle: "Hilma af Klint - Les peintures du Temple (1906-1915)",
      },
    ],
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
  {
    key: "tickets",
    title: "Horaires tickets resto",
    description: "Horaires de retrait des titres au guichet.",
    documents: [],
    image: {
      src: "/useful-forms/horaires-tickets-repas-fast.webp",
      alt: "Horaires de distribution des chèques repas au bureau 339",
    },
  },
];

export function usefulFormFoldersForDate(
  today: string,
  program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM,
) {
  const programEntries = Object.values(program)
    .flatMap((venue) => Object.values(venue.schedule))
    .flatMap((entries) => entries ?? []);
  return USEFUL_FORM_FOLDERS.map((folder) => ({
    ...folder,
    documents: folder.key !== "expo"
      ? folder.documents
      : folder.documents.filter((document) => {
          if (!document.programEntryTitle) return true;
          const matchingEntries = programEntries.filter((entry) => entry.title === document.programEntryTitle);
          return !matchingEntries.length || matchingEntries.some((entry) => isGrandPalaisEntryVisible(entry, today));
        }),
  }));
}

function documentCount(count: number) {
  if (!count) return "Vide pour le moment";
  return `${count} document${count > 1 ? "s" : ""}`;
}

type UsefulFormsSectionProps = {
  today?: string;
  status?: PayStatus;
  periods?: LeavePeriod[];
  onSaveWorkAccident?: (period: { from: string; to: string }) => Promise<boolean>;
  onDeleteWorkAccident?: (period: LeavePeriod) => Promise<boolean>;
  accountId?: string;
  isAdmin?: boolean;
  demoMode?: boolean;
};

export function UsefulFormsSection({
  today = new Date().toISOString().slice(0, 10),
  status = "contractuel",
  periods = [],
  onSaveWorkAccident = async () => false,
  onDeleteWorkAccident = async () => false,
  accountId = "",
  isAdmin = false,
  demoMode = false,
}: UsefulFormsSectionProps = {}) {
  const [activeFolder, setActiveFolder] = useState<UsefulFormsFolderKey | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState(() => readResourceFavorites(accountId, "documents"));
  const [sharedDocuments, setSharedDocuments] = useState<SharedUsefulDocument[]>([]);
  const [adminTitle, setAdminTitle] = useState("");
  const [adminFolder, setAdminFolder] = useState<UsefulDocumentFolderKey>("expo");
  const [adminFile, setAdminFile] = useState<File | null>(null);
  const [notifyGuests, setNotifyGuests] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminError, setAdminError] = useState("");
  const allFolders = useMemo(() => usefulFormFoldersForDate(today).map((item) => ({
    ...item,
    documents: [
      ...item.documents,
      ...sharedDocuments
        .filter((document) => document.folder === item.key)
        .map((document) => ({ title: document.title, file: document.id, format: document.format, href: document.href })),
    ],
  })), [sharedDocuments, today]);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("fr");
  const visibleFolders = useMemo(() => allFolders.filter((item) => !normalizedSearch
    || item.title.toLocaleLowerCase("fr").includes(normalizedSearch)
    || item.documents.some((document) => document.title.toLocaleLowerCase("fr").includes(normalizedSearch))), [allFolders, normalizedSearch]);
  const favoriteDocuments = allFolders.flatMap((item) => item.documents.map((document) => ({ ...document, folderKey: item.key }))).filter((document) => favorites.includes(document.file));
  const toggleFavorite = (file: string) => setFavorites((current) => {
    const next = current.includes(file) ? current.filter((item) => item !== file) : [...current, file];
    writeResourceFavorites(accountId, "documents", next);
    return next;
  });
  useEffect(() => {
    void import("./WorkAccidentSection");
  }, []);
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void getSharedUsefulDocuments()
      .then((payload) => active && setSharedDocuments(payload.documents))
      .catch(() => { /* Les documents intégrés restent disponibles hors ligne. */ });
    return () => { active = false; };
  }, [demoMode]);
  const folder = visibleFolders.find((item) => item.key === activeFolder);
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

  const openFolder = (key: UsefulFormsFolderKey) => {
    setActiveFolder(key);
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminFile || adminBusy) return;
    const form = event.currentTarget;
    setAdminBusy(true);
    setAdminError("");
    setAdminMessage("");
    try {
      if (demoMode) {
        const format = adminFile.name.toLocaleLowerCase("fr").endsWith(".docx") ? "DOCX" : "PDF";
        setSharedDocuments((current) => [...current, {
          id: `demo-${Date.now()}`,
          title: adminTitle.trim(),
          folder: adminFolder,
          format,
          createdAt: new Date().toISOString(),
          href: URL.createObjectURL(adminFile),
        }]);
        setAdminMessage("Document ajouté à la démo locale. Aucune alerte ni aucun e-mail n’a été envoyé.");
      } else {
        const result = await addSharedUsefulDocument({
          title: adminTitle,
          folder: adminFolder,
          file: adminFile,
          notifyGuests,
        });
        setSharedDocuments((current) => [...current.filter((item) => item.id !== result.document.id), result.document]);
        if (!result.announcement) {
          setAdminMessage("Document ajouté sans alerte aux comptes invités.");
        } else if (!result.announcement.directoryAvailable) {
          setAdminMessage("Document ajouté, mais l’annuaire des comptes invités était indisponible : aucune alerte n’a été envoyée.");
        } else {
          const { accounts, inAppAlerts, emailsSent, emailsFailed } = result.announcement;
          setAdminMessage(`Document ajouté · ${inAppAlerts}/${accounts} alerte${accounts > 1 ? "s" : ""} dans l’application · ${emailsSent}/${accounts} e-mail${accounts > 1 ? "s" : ""} envoyé${emailsSent > 1 ? "s" : ""}${emailsFailed ? ` · ${emailsFailed} échec${emailsFailed > 1 ? "s" : ""}` : ""}.`);
        }
      }
      setAdminTitle("");
      setAdminFile(null);
      setNotifyGuests(false);
      form.reset();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Le document n’a pas pu être ajouté.");
    } finally {
      setAdminBusy(false);
    }
  };

  if (activeFolder === "work-accident") {
    return (
      <Suspense fallback={<div className="deferred-section-loading" role="status">Ouverture de la déclaration…</div>}>
      <WorkAccidentSection
        initialStatus={status}
        periods={periods}
        onSave={onSaveWorkAccident}
        onDelete={onDeleteWorkAccident}
        onBack={() => setActiveFolder(null)}
      />
      </Suspense>
    );
  }

  if (folder) {
    return (
      <section className="useful-forms-screen useful-forms-folder-screen" aria-labelledby="useful-forms-folder-title">
        <header className={`useful-forms-folder-header tone-${folder.key}`}>
          <button
            className="native-back-button section-back-hit-area"
            type="button"
            onClick={() => setActiveFolder(null)}
            aria-label="Revenir aux dossiers de formulaires"
          >
            <span className="section-back-arrow" aria-hidden="true">←</span>
          </button>
          <div>
            <span className="step-label">Formulaires utiles</span>
            <h2 id="useful-forms-folder-title">{folder.title}</h2>
            <small>{folder.image ? "Information pratique" : documentCount(folder.documents.length)}</small>
          </div>
        </header>

        {folder.image ? (
          <figure className="useful-form-information-image">
            <img
              src={folder.image.src}
              alt={folder.image.alt}
              width="971"
              height="1620"
              loading="lazy"
              decoding="async"
            />
          </figure>
        ) : folder.documents.length ? (
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
                  href={document.href || `/useful-forms/${document.file}`}
                  download
                  aria-label={`${action === "preview" ? "Ouvrir" : "Télécharger"} ${document.title}`}
                  aria-busy={downloadingFile === document.file}
                  onClick={(event) => void downloadForm(event, document.file, action)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v12m-4-4 4 4 4-4M5 19h14" />
                  </svg>
                  <span className="useful-form-download-label">
                    {downloadingFile === document.file
                      ? "Préparation…"
                      : action === "preview" ? "Ouvrir le PDF" : "Télécharger"}
                  </span>
                </a>
                <button type="button" className="resource-favorite-button" aria-pressed={favorites.includes(document.file)} aria-label={`${favorites.includes(document.file) ? "Retirer" : "Ajouter"} ${document.title} ${favorites.includes(document.file) ? "des" : "aux"} favoris`} onClick={() => toggleFavorite(document.file)}>★</button>
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
    <>
    <section className="useful-forms-screen useful-forms-root" aria-labelledby="useful-forms-title">
      <div className="native-screen-heading">
        <span className="step-label">Documents pratiques</span>
        <h2 id="useful-forms-title">Formulaires utiles</h2>
        <p>Choisissez un dossier puis téléchargez directement le document dont vous avez besoin.</p>
      </div>
      <label className="resource-search-field"><span>Rechercher un document</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nom du document" /></label>
      {isAdmin ? (
        <details className="useful-document-admin-panel">
          <summary><span aria-hidden="true">＋</span><strong>Ajouter un document</strong><small>Compte administrateur</small></summary>
          <form onSubmit={(event) => void submitDocument(event)}>
            <label><span>Titre du document</span><input required minLength={3} maxLength={120} value={adminTitle} onChange={(event) => setAdminTitle(event.target.value)} placeholder="Ex. Consignes de la nouvelle exposition" /></label>
            <label><span>Rubrique</span><select value={adminFolder} onChange={(event) => setAdminFolder(event.target.value as UsefulDocumentFolderKey)}><option value="expo">Formulaire Expo</option><option value="sap">Formulaire SAP</option><option value="brantome">Formulaire Brantôme</option></select></label>
            <label className="useful-document-file"><span>Fichier PDF ou DOCX</span><input required type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" onChange={(event) => setAdminFile(event.target.files?.[0] || null)} /><small>3 Mo maximum</small></label>
            <label className="useful-document-alert-choice"><input type="checkbox" checked={notifyGuests} onChange={(event) => setNotifyGuests(event.target.checked)} /><span><strong>Alerter tous les comptes invités</strong><small>Affiche une fenêtre au centre de leur application et envoie aussi un e-mail.</small></span></label>
            <button type="submit" disabled={adminBusy || !adminFile || adminTitle.trim().length < 3}>{adminBusy ? "Ajout en cours…" : "Ajouter le document"}</button>
            {adminMessage ? <p className="useful-document-admin-success" role="status">{adminMessage}</p> : null}
            {adminError ? <p className="useful-form-download-error" role="alert">{adminError}</p> : null}
          </form>
        </details>
      ) : null}
      <div className="useful-form-content-stack">
      {favoriteDocuments.length && !normalizedSearch ? <section className="resource-favorites-strip" aria-label="Documents favoris"><strong>Favoris</strong><div>{favoriteDocuments.map((document) => <button key={document.file} type="button" onClick={() => openFolder(document.folderKey)}>★ {document.title}</button>)}</div></section> : null}
      <div className="useful-form-folder-grid">
        {visibleFolders.map((item) => (
          <button
            key={item.key}
            className={`useful-form-folder tone-${item.key}`}
            type="button"
            onClick={() => openFolder(item.key)}
          >
            <span className="useful-form-folder-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 6h7l2 2h9v11H3z" />
              </svg>
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.image ? "Information pratique" : documentCount(item.documents.length)}</small>
              <em>{item.description}</em>
            </span>
          </button>
        ))}
        <button className="useful-form-folder useful-form-work-accident-entry tone-accident" type="button" onClick={() => openFolder("work-accident")}>
          <WorkAccidentIcon className="useful-form-folder-icon" />
          <span>
            <strong>Déclarer un accident de travail</strong>
            <small>Accident de travail</small>
            <em>Procédure, contacts, documents et ajout au planning.</em>
          </span>
        </button>
      </div>
      </div>
    </section>
    </>
  );
}
