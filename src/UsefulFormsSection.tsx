import { lazy, Suspense, useEffect, useMemo, useState, type MouseEvent } from "react";
import "./usefulFolders.css";
import type { LeavePeriod } from "./appModel";
import { WorkAccidentIcon } from "./WorkAccidentIcon";
import {
  GRAND_PALAIS_PROGRAM,
  isGrandPalaisEntryVisible,
  type GrandPalaisProgramData,
} from "./GrandPalaisProgramSection";
import { readResourceFavorites, writeResourceFavorites } from "./resourceFavorites";
import { matchesSearch } from "./searchMatching";
import "./usefulDocumentAdmin.css";
import { DocumentShareDialog } from "./DocumentShareDialog";
import { DocumentUpload } from "./DocumentUpload";
import { DocumentEditDialog } from "./DocumentEditDialog";
import {
  getSharedUsefulDocuments,
  type SharedUsefulDocument,
  type UsefulDocumentEdit,
} from "./usefulDocumentsApi";

const WorkAccidentSection = lazy(() => import("./WorkAccidentSection").then((module) => ({ default: module.WorkAccidentSection })));

export type UsefulFormsFolderKey = "expo" | "sap" | "brantome" | "tickets" | "work-accident";

type UsefulFormDocument = {
  title: string;
  file: string;
  format: "PDF" | "DOCX";
  programEntryTitle?: string;
  href?: string;
  publishAt?: string;
  /** Adresse à laquelle renvoyer le formulaire rempli. */
  sendTo?: string;
};

/** Un audioguide d'exposition : la page que le QR code ouvre, et le code
 *  d'accès à y saisir. Il disparaît avec l'exposition. */
type UsefulAudioguide = {
  title: string;
  programEntryTitle: string;
  url: string;
  code: string;
  languages: string;
  /** Le QR code d'origine, à montrer pour qu'un visiteur le flashe. */
  qr: string;
};

type UsefulFormsFolder = {
  key: UsefulFormsFolderKey;
  title: string;
  documents: UsefulFormDocument[];
  audioguides?: UsefulAudioguide[];
  description: string;
  image?: { src: string; alt: string };
};

export function getUsefulFormAction(format: UsefulFormDocument["format"], secureContext: boolean) {
  return !secureContext && format === "PDF" ? "preview" : "download";
}

export const USEFUL_FORM_FOLDERS: UsefulFormsFolder[] = [
  {
    key: "expo",
    title: "Formulaire Expo",
    description: "Consignes et documents d’exposition",
    documents: [
      {
        title: "Hilma Af Klint",
        file: "hilma-af-klint.pdf",
        format: "PDF",
        programEntryTitle: "Hilma af Klint - Les peintures du Temple (1906-1915)",
      },
    ],
    audioguides: [
      {
        title: "Cézanne et nous",
        programEntryTitle: "Cezanne et nous",
        url: "https://audioguide.grandpalais.fr/bypass",
        code: "7268",
        languages: "Français et anglais",
        qr: "/useful-forms/audioguide-cezanne-qr.png",
      },
    ],
  },
  {
    key: "sap",
    title: "Formulaire SAP",
    description: "Congés, récupérations, annulations",
    documents: [
      { title: "Demande de congés", file: "demande-conges.pdf", format: "PDF" },
      { title: "Demande de récupérations", file: "demande-recuperations.pdf", format: "PDF" },
      { title: "Demande d’annulation de congés", file: "demande-annulation-conges.pdf", format: "PDF" },
    ],
  },
  {
    key: "brantome",
    title: "Formulaire Brantôme",
    description: "Coordonnées, cartes, restauration, CET",
    documents: [
      { title: "Formulaire de changement de coordonnées", file: "formulaire-changement-coordonnees.pdf", format: "PDF" },
      { title: "Changement de coordonnées bancaires", file: "changement-coordonnees-bancaires.docx", format: "DOCX" },
      { title: "Demande de carte de restauration BIMPLI", file: "demande-carte-restauration-bimpli.pdf", format: "PDF" },
      { title: "Procuration pour le retrait des titres-restaurant", file: "procuration-retrait-titres-repas.pdf", format: "PDF" },
      { title: "Demande de Carte Culture A", file: "demande-carte-culture-a.pdf", format: "PDF" },
      { title: "Formulaire d’adhésion carte POP", file: "adhesion-carte-pop.pdf", format: "PDF", sendTo: "collectivites@centrepompidou.fr" },
      { title: "CET - Demande d’ouverture", file: "cet-demande-ouverture.pdf", format: "PDF" },
      { title: "CET - Alimentation et indemnisation", file: "cet-alimentation-indemnisation.pdf", format: "PDF" },
    ],
  },
  {
    key: "tickets",
    title: "Horaires tickets resto",
    description: "Retrait des titres au guichet",
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
  // Une fiche ou un audioguide d'exposition s'efface quand l'exposition se termine.
  const stillOpen = (item: { programEntryTitle?: string }) => {
    if (!item.programEntryTitle) return true;
    const matchingEntries = programEntries.filter((entry) => entry.title === item.programEntryTitle);
    return !matchingEntries.length || matchingEntries.some((entry) => isGrandPalaisEntryVisible(entry, today));
  };
  return USEFUL_FORM_FOLDERS.map((folder) => ({
    ...folder,
    documents: folder.key !== "expo" ? folder.documents : folder.documents.filter(stillOpen),
    audioguides: folder.audioguides?.filter(stillOpen),
  }));
}

function documentCount(count: number, audioguides = 0) {
  const parts = [
    count ? `${count} document${count > 1 ? "s" : ""}` : "",
    audioguides ? `+ ${audioguides} audioguide${audioguides > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vide pour le moment";
}

type UsefulFormsSectionProps = {
  today?: string;
  periods?: LeavePeriod[];
  onSaveWorkAccident?: (period: { from: string; to: string }) => Promise<boolean>;
  onDeleteWorkAccident?: (period: LeavePeriod) => Promise<boolean>;
  accountId?: string;
  isAdmin?: boolean;
  demoMode?: boolean;
};

/** Quand un dossier réunit des documents et des audioguides, un intitulé
 *  sépare les deux, au singulier ou au pluriel ; sinon, aucun intitulé. */
export function folderListHeadings(documents: number, audioguides: number) {
  if (!documents || !audioguides) return null;
  return {
    documents: documents > 1 ? "Documents" : "Document",
    audioguides: audioguides > 1 ? "Audioguides" : "Audioguide",
  };
}

export function UsefulFormsSection({
  today = new Date().toISOString().slice(0, 10),
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
  const [shownQr, setShownQr] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState(() => readResourceFavorites(accountId, "documents"));
  const [sharedDocuments, setSharedDocuments] = useState<SharedUsefulDocument[]>([]);
  const [shareDocument, setShareDocument] = useState<UsefulFormDocument | null>(null);
  const [editDocument, setEditDocument] = useState<UsefulFormDocument | null>(null);
  const [documentEdits, setDocumentEdits] = useState<UsefulDocumentEdit[]>([]);
  const allFolders = useMemo(() => usefulFormFoldersForDate(today).map((item) => ({
    ...item,
    documents: [
      ...item.documents,
      ...sharedDocuments
        .filter((document) => document.folder === item.key && (isAdmin || !document.publishAt || Date.parse(document.publishAt) <= Date.now()))
        .map((document) => ({ title: document.title, file: document.id, format: document.format, href: document.href, publishAt: document.publishAt })),
    ].filter(document => !documentEdits.find(edit => edit.id === document.file)?.deleted)
      .map(document => ({ ...document, href: documentEdits.find(edit => edit.id === document.file)?.href || document.href, title: documentEdits.find(edit => edit.id === document.file)?.title || document.title })),
  })), [sharedDocuments, today, documentEdits, isAdmin]);
  const normalizedSearch = searchQuery.trim();
  const visibleFolders = useMemo(() => allFolders.filter((item) => matchesSearch(item.title, normalizedSearch)
    || item.documents.some((document) => matchesSearch(document.title, normalizedSearch))
    || Boolean(item.audioguides?.some((guide) => matchesSearch(`Audioguide ${guide.title}`, normalizedSearch)))), [allFolders, normalizedSearch]);
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
    const refresh = () => void getSharedUsefulDocuments()
      .then((payload) => { if (active) { setSharedDocuments(payload.documents); setDocumentEdits(payload.catalogEdits || []); } })
      .catch(() => { /* Les documents intégrés restent disponibles hors ligne. */ });
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [demoMode]);
  const folder = visibleFolders.find((item) => item.key === activeFolder);
  const headings = folder ? folderListHeadings(folder.documents.length, folder.audioguides?.length ?? 0) : null;
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
        // La fiche s'ouvre toujours sur le parcours contractuel ; on bascule
        // sur « Fonctionnaire » d'un appui.
        initialStatus="contractuel"
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
            <small>{folder.image ? "Information pratique" : documentCount(folder.documents.length, folder.audioguides?.length)}</small>
          </div>
        </header>

        {isAdmin && (folder.key === "expo" || folder.key === "sap" || folder.key === "brantome") ? <DocumentUpload key={folder.key} folder={folder.key} demoMode={demoMode} onAdded={document => setSharedDocuments(current => [...current.filter(item => item.id !== document.id), document])} /> : null}
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
        ) : folder.documents.length || folder.audioguides?.length ? (
          <div className="useful-form-download-list">
            {!secureContext ? (
              <p className="useful-form-local-notice">
                Mode de test local : les PDF s’ouvrent dans le lecteur du navigateur. Utilisez ensuite son bouton Enregistrer. Le téléchargement direct sans alerte sera disponible sur la version sécurisée.
              </p>
            ) : null}
            {headings ? <h3 className="useful-form-list-heading">{headings.documents}</h3> : null}
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
                  {"sendTo" in document && document.sendTo ? <small className="useful-form-send-to">À envoyer à <a href={`mailto:${document.sendTo}`}>{document.sendTo.split("@")[0]}<wbr />@{document.sendTo.split("@")[1]}</a></small> : null}
                  {isAdmin && document.publishAt && Date.parse(document.publishAt) > Date.now() && <small>{document.publishAt.startsWith('9999') ? 'Brouillon · À reprogrammer' : `Publication le ${new Date(document.publishAt).toLocaleString('fr-FR')}`}</small>}
                  {isAdmin && <button className="document-edit-button" type="button" aria-label={`Modifier ${document.title}`} onClick={() => setEditDocument(document)}>Modifier</button>}
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
                {!isAdmin && <button type="button" className="resource-favorite-button" aria-pressed={favorites.includes(document.file)} aria-label={`${favorites.includes(document.file) ? "Retirer" : "Ajouter"} ${document.title} ${favorites.includes(document.file) ? "des" : "aux"} favoris`} onClick={() => toggleFavorite(document.file)}>★</button>}
                {isAdmin && <button type="button" className="document-share-button" aria-label={`Partager ${document.title}`} title="Partager ce document" onClick={() => setShareDocument(document)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg></button>}
              </article>
              );
            })}
            {/* Les audioguides suivent les fiches, dans le même format : ouvrir
                sans scanner (le code d'accès est copié) ou montrer le QR code. */}
            {headings ? <h3 className="useful-form-list-heading">{headings.audioguides}</h3> : null}
            {folder.audioguides?.map((guide, index) => (
              <article key={guide.title} className="useful-form-download-card useful-audioguide-card">
                <span className="useful-form-file-icon useful-audioguide-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><path d="M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zm16 0a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z" /></svg>
                </span>
                <span className="useful-form-file-copy">
                  <small>{index + 1}. AUDIOGUIDE</small>
                  <strong>Audioguide {guide.title}</strong>
                  <small className="useful-audioguide-code">{guide.languages}</small>
                  <small className="useful-audioguide-code">Code d’accès <b>{guide.code}</b></small>
                </span>
                <span className="useful-audioguide-actions">
                  <a
                    href={guide.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void navigator.clipboard?.writeText(guide.code).catch(() => undefined)}
                  >
                    Ouvrir l’audioguide
                  </a>
                  <button type="button" aria-expanded={shownQr === guide.title} onClick={() => setShownQr((current) => (current === guide.title ? "" : guide.title))}>
                    {shownQr === guide.title ? "Masquer le QR code" : "Afficher le QR code"}
                  </button>
                </span>
                {shownQr === guide.title ? (
                  <figure className="useful-audioguide-qr">
                    <img src={guide.qr} alt={`QR code de l’audioguide ${guide.title}`} width="240" height="240" />
                    <figcaption>Code d’accès <b>{guide.code}</b></figcaption>
                  </figure>
                ) : null}
              </article>
            ))}
            {downloadError ? <p className="useful-form-download-error" role="alert">{downloadError}</p> : null}
          </div>
        ) : (
          <div className="useful-forms-empty">
            <span aria-hidden="true">＋</span>
            <strong>Aucun formulaire pour le moment</strong>
            <p>Ce dossier est prêt à recevoir les futurs formulaires Expo.</p>
          </div>
        )}
        {isAdmin && shareDocument ? <DocumentShareDialog document={shareDocument} demoMode={demoMode} onClose={() => setShareDocument(null)} /> : null}
        {isAdmin && editDocument ? <DocumentEditDialog document={editDocument} demoMode={demoMode} onClose={() => setEditDocument(null)} onEdited={edit => setDocumentEdits(current => [...current.filter(item => item.id !== edit.id), { ...current.find(item => item.id === edit.id), ...edit }])} /> : null}
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
              <small>{item.image ? "Information pratique" : documentCount(item.documents.length, item.audioguides?.length)}</small>
              <em>{item.description}</em>
            </span>
          </button>
        ))}
        <button className="useful-form-folder useful-form-work-accident-entry tone-accident" type="button" onClick={() => openFolder("work-accident")}>
          <WorkAccidentIcon className="useful-form-folder-icon" />
          <span>
            <strong>Déclarer un accident de travail</strong>
            <em>Procédure, contacts, documents et ajout au planning.</em>
          </span>
        </button>
      </div>
      </div>
    </section>
    </>
  );
}
