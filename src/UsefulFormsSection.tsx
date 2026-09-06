import { lazy, Suspense, useEffect, useMemo, useState, type MouseEvent } from "react";
import type { LeavePeriod, PayStatus } from "./appModel";
import { WorkAccidentIcon } from "./WorkAccidentIcon";
import {
  GRAND_PALAIS_PROGRAM,
  isGrandPalaisEntryVisible,
  type GrandPalaisProgramData,
} from "./GrandPalaisProgramSection";
import { readResourceFavorites, writeResourceFavorites } from "./resourceFavorites";

const WorkAccidentSection = lazy(() => import("./WorkAccidentSection").then((module) => ({ default: module.WorkAccidentSection })));

export type UsefulFormsFolderKey = "expo" | "sap" | "brantome" | "tickets" | "work-accident";

type UsefulFormDocument = {
  title: string;
  file: string;
  format: "PDF" | "DOCX";
  programEntryTitle?: string;
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
};

export function UsefulFormsSection({
  today = new Date().toISOString().slice(0, 10),
  status = "contractuel",
  periods = [],
  onSaveWorkAccident = async () => false,
  onDeleteWorkAccident = async () => false,
  accountId = "",
}: UsefulFormsSectionProps = {}) {
  const [activeFolder, setActiveFolder] = useState<UsefulFormsFolderKey | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState(() => readResourceFavorites(accountId, "documents"));
  const allFolders = useMemo(() => usefulFormFoldersForDate(today), [today]);
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
                  href={`/useful-forms/${document.file}`}
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
