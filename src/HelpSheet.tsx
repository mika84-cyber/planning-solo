import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { GRAND_PALAIS_PROGRAM, grandPalaisTitleKey } from "./grandPalaisProgramData";
import type { GrandPalaisProgramEntry } from "./grandPalaisProgramData";
import "./helpSheet.css";
import { getUsefulFormAction, usefulFormFoldersForDate } from "./UsefulFormsSection";
import { getSharedUsefulDocuments } from "./usefulDocumentsApi";

/** Ce que chaque question ouvre ; App.tsx fait le chemin. */
export type HelpChoice =
  | "phone" | "form" | "planning-pdf" | "expo-dates" | "expo-folder" | "interexpo" | "radio"
  | "allowances" | "payslip-check" | "pay-detail"
  | "overtime-mecenat" | "work-accident" | "request-form" | "cet";

type Tone = "blue" | "teal" | "green" | "terra" | "red";

const icon = (path: ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true">{path}</svg>;
const ICONS: Record<string, ReactNode> = {
  phone: icon(<path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />),
  form: icon(<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>),
  download: icon(<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />),
  expo: icon(<path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6" />),
  picture: icon(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m4 15 4-4 4 4 3-3 5 5" /><circle cx="15.5" cy="8.5" r="1.3" /></>),
  inter: icon(<><rect x="3" y="7" width="7" height="10" rx="1" /><rect x="14" y="7" width="7" height="10" rx="1" /><path d="M10 12h4" /></>),
  radio: icon(<><rect x="7" y="7" width="10" height="14" rx="2" /><path d="M14 7V3M10 11h4M10 14.5h4" /></>),
  prime: icon(<><circle cx="12" cy="12" r="8" /><path d="M14.8 9a3.4 3.4 0 1 0 0 6M8 11h5M8 13.2h5" /></>),
  check: icon(<><path d="M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21z" /><path d="m9.5 11 1.8 1.8 3.4-3.6" /></>),
  calc: icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8.5 12h1M12 12h1M15 12h.5M8.5 16h1M12 16h1M15 16h.5" /></>),
  clock: icon(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
  accident: icon(<><path d="M12 4 3 20h18z" /><path d="M12 10v4.5M12 17.2v.3" /></>),
  leave: icon(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4" /></>),
  piggy: icon(<><path d="M5 11a7 6 0 0 1 12.5-3.3L20 7l-.6 3.3A6 6 0 0 1 18 15v4h-3v-2h-4v2H8v-3.4A6 6 0 0 1 5 11Z" /><path d="M10 8h3" /></>),
  headphones: icon(<><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3.5" y="14" width="4" height="6" rx="1.5" /><rect x="16.5" y="14" width="4" height="6" rx="1.5" /></>),
};

type Question = { id: HelpChoice; icon: string; tone: Tone; question: string; where: string };

const QUESTIONS: Record<"find" | "pay" | "declare", Question[]> = {
  find: [
    { id: "phone", icon: "phone", tone: "blue", question: "Un numéro de téléphone", where: "Docs · Contacts" },
    { id: "form", icon: "form", tone: "blue", question: "Un formulaire", where: "Docs · Formulaires" },
    { id: "planning-pdf", icon: "download", tone: "blue", question: "Télécharger un planning", where: "Plannings en PDF" },
    { id: "expo-dates", icon: "expo", tone: "teal", question: "Les dates d’une exposition", where: "Expos · À venir" },
    // L'exposition des Galeries 3 et 4 vient ici (voir GalleryExpoRow).
    { id: "interexpo", icon: "inter", tone: "teal", question: "Les dates d’inter-expos", where: "Expos · Inter-expos" },
    { id: "radio", icon: "radio", tone: "red", question: "Un code radio d’urgence", where: "Docs · Contacts · Codes urgences radio" },
  ],
  pay: [
    { id: "allowances", icon: "prime", tone: "green", question: "Le détail de mes primes", where: "Ma paie · Primes et jours fériés" },
    { id: "payslip-check", icon: "check", tone: "green", question: "Vérifier un bulletin", where: "Ma paie · Vérifier le bulletin" },
    { id: "pay-detail", icon: "calc", tone: "green", question: "Comprendre ma paie", where: "Ma paie · Détail du calcul" },
  ],
  declare: [
    { id: "overtime-mecenat", icon: "clock", tone: "terra", question: "Un mécénat ou des heures sup", where: "Congés · Heures et mécénats" },
    { id: "work-accident", icon: "accident", tone: "red", question: "Un accident de travail", where: "Docs · Accident de travail" },
    { id: "request-form", icon: "leave", tone: "terra", question: "Une absence ou un échange", where: "Formulaire de demande" },
    { id: "cet", icon: "piggy", tone: "terra", question: "Ouvrir ou alimenter mon CET", where: "Congés · CET" },
  ],
};

/** L'exposition des Galeries 3 et 4 du jour, ou la prochaine pendant une
 *  inter-expo. */
export function galleryExpoFor(today: string, program = GRAND_PALAIS_PROGRAM) {
  const entries = Object.values(program.galleries34.schedule)
    .flatMap((items) => items ?? [])
    .filter((entry): entry is GrandPalaisProgramEntry & { startsOn: string; endsOn: string } => Boolean(entry.startsOn && entry.endsOn))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const current = entries.find((entry) => entry.startsOn <= today && today <= entry.endsOn);
  if (current) return { entry: current, current: true };
  const next = entries.find((entry) => entry.startsOn > today);
  return next ? { entry: next, current: false } : null;
}

type ExpoDocument = { title: string; file: string; format: "PDF" | "DOCX"; href?: string; programEntryTitle?: string };

/** La fiche PDF de l'exposition dans le dossier Expo : rattachée par son titre
 *  d'exposition, ou par un mot du titre (« Fiche Cézanne »). */
export function expoSheetFor(title: string, documents: ExpoDocument[]) {
  const words = grandPalaisTitleKey(title).split(" ").filter((word) => word.length >= 4);
  return documents.find((document) => document.format === "PDF" && (
    document.programEntryTitle === title
    || grandPalaisTitleKey(document.title).split(" ").some((word) => words.includes(word))
  ));
}

async function downloadDocument(href: string, name: string) {
  if (getUsefulFormAction("PDF", window.isSecureContext) === "preview") {
    window.open(href, "_blank", "noopener");
    return;
  }
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok) throw new Error(String(response.status));
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

function QuestionRow({ item, onChoose }: { item: Question; onChoose: (id: HelpChoice) => void }) {
  return (
    <li>
      <button type="button" className="help-sheet-row" onClick={() => onChoose(item.id)}>
        <span className={`help-sheet-icon tone-${item.tone}`}>{ICONS[item.icon]}</span>
        <span className="help-sheet-copy"><strong>{item.question}</strong><small>{item.where}</small></span>
        <span className="help-sheet-chevron" aria-hidden="true">›</span>
      </button>
    </li>
  );
}

/** L'audioguide : un toucher déplie, dans la fenêtre même, le QR code à
 *  faire scanner et le code d'accès — sans quitter l'application. */
export function AudioguideRow({ title, audioguide, initiallyOpen = false }: {
  title: string;
  audioguide: { code: string; languages: string; qr: string };
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <li className="help-sheet-audioguide">
      <button type="button" className="help-sheet-row" aria-expanded={open} aria-controls="help-sheet-audioguide-qr" onClick={() => setOpen((current) => !current)}>
        <span className="help-sheet-icon tone-teal">{ICONS.headphones}</span>
        <span className="help-sheet-copy">
          <strong>Audioguide · {title}</strong>
          <small>{open ? "Faites scanner le QR code" : "QR code et code d’accès"}</small>
        </span>
        <span className="help-sheet-chevron" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="help-sheet-qr" id="help-sheet-audioguide-qr">
          <img src={audioguide.qr} alt={`QR code de l’audioguide ${title}`} width="168" height="168" />
          <span className="help-sheet-qr-code">Code d’accès <b>{audioguide.code}</b></span>
          <small>{audioguide.languages}</small>
        </div>
      ) : null}
    </li>
  );
}

/** L'exposition des Galeries 3 et 4, en deux lignes : sa fiche d'exposition
 *  (le PDF du dossier Expo) et son audioguide. */
function GalleryExpoRow({ today, onChoose }: { today: string; onChoose: (id: HelpChoice) => void }) {
  const gallery = useMemo(() => galleryExpoFor(today), [today]);
  const [sharedDocuments, setSharedDocuments] = useState<ExpoDocument[]>([]);
  const [downloadState, setDownloadState] = useState<"idle" | "busy" | "failed">("idle");
  useEffect(() => {
    let active = true;
    getSharedUsefulDocuments()
      .then((payload) => {
        if (!active) return;
        setSharedDocuments(payload.documents
          .filter((document) => document.folder === "expo" && (!document.publishAt || Date.parse(document.publishAt) <= Date.now()))
          .map((document) => ({ title: document.title, file: document.id, format: document.format, href: document.href })));
      })
      .catch(() => { /* Sans réseau, la fiche intégrée suffit. */ });
    return () => { active = false; };
  }, []);
  const sheet = useMemo(() => {
    if (!gallery) return undefined;
    const builtIn = usefulFormFoldersForDate(today).find((folder) => folder.key === "expo")?.documents ?? [];
    return expoSheetFor(gallery.entry.title, [...builtIn, ...sharedDocuments]);
  }, [gallery, today, sharedDocuments]);
  if (!gallery) return null;
  const { entry, current } = gallery;
  const download = async () => {
    if (!sheet) return;
    setDownloadState("busy");
    try {
      await downloadDocument(sheet.href || `/useful-forms/${sheet.file}`, `${grandPalaisTitleKey(entry.title).replace(/ /g, "-") || "fiche"}.pdf`);
      setDownloadState("idle");
    } catch {
      setDownloadState("failed");
    }
  };
  const label = `Galeries 3 et 4 · ${current ? "en ce moment" : "prochainement"}`;
  return (
    <>
      {/* La fiche d'exposition : téléchargée d'un toucher quand le dossier
          Expo la contient, sinon le dossier s'ouvre. */}
      <li className="help-sheet-expo">
        <button
          type="button"
          className="help-sheet-row"
          disabled={downloadState === "busy"}
          onClick={() => (sheet ? void download() : onChoose("expo-folder"))}
        >
          <span className="help-sheet-icon tone-teal">{sheet ? ICONS.download : ICONS.picture}</span>
          <span className="help-sheet-copy">
            <strong>Fiche d’expo · {entry.title}</strong>
            <small>{downloadState === "busy" ? "Téléchargement…" : sheet ? `${label} · PDF` : "Docs · Formulaire Expo"}</small>
          </span>
          <span className="help-sheet-chevron" aria-hidden="true">{sheet ? "↓" : "›"}</span>
        </button>
        {downloadState === "failed" ? <small className="help-sheet-error" role="alert">Le téléchargement n’a pas pu démarrer. Réessayez.</small> : null}
      </li>
      {entry.audioguide ? <AudioguideRow title={entry.title} audioguide={entry.audioguide} /> : null}
    </>
  );
}

/**
 * « Que cherchez-vous ? » : la fenêtre ouverte par la pastille du même nom dans
 * l'en-tête de chaque page. Trois groupes de questions ; chacune ouvre
 * directement la page, l'onglet ou la sous-page qui y répond.
 */
export function HelpSheet({ today, section, onChoose, onClose }: {
  today: string;
  /** La page ouverte : les titres de groupe prennent la couleur de son en-tête. */
  section?: string;
  onChoose: (id: HelpChoice) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal?.();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="help-sheet"
      data-section={section}
      aria-label="Que cherchez-vous ?"
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      // Un toucher sur le voile, hors du panneau, ferme la fenêtre.
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="help-sheet-panel">
        <span className="help-sheet-grip" aria-hidden="true" />
        <header className="help-sheet-head">
          <h2 id="help-sheet-title">Que cherchez-vous ?</h2>
          <button type="button" className="help-sheet-close" aria-label="Fermer" onClick={onClose}>×</button>
        </header>
        <p className="help-sheet-lead">Touchez une question : la bonne page s’ouvre.</p>
        <h3>Trouver</h3>
        <ul aria-label="Trouver">
          {QUESTIONS.find.slice(0, 4).map((item) => <QuestionRow key={item.id} item={item} onChoose={onChoose} />)}
          <GalleryExpoRow today={today} onChoose={onChoose} />
          {QUESTIONS.find.slice(4).map((item) => <QuestionRow key={item.id} item={item} onChoose={onChoose} />)}
        </ul>
        <h3>Ma paie</h3>
        <ul aria-label="Ma paie">
          {QUESTIONS.pay.map((item) => <QuestionRow key={item.id} item={item} onChoose={onChoose} />)}
        </ul>
        <h3>Déclarer</h3>
        <ul aria-label="Déclarer">
          {QUESTIONS.declare.map((item) => <QuestionRow key={item.id} item={item} onChoose={onChoose} />)}
        </ul>
      </div>
    </dialog>
  );
}

export default HelpSheet;
