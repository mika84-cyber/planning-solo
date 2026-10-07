import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { NoteListItem } from "./appModel";
import { NotesPanelContent } from "./PlanningView";
import "./sharedNotes.css";
import "./homeOverview.css";
import {
  compactWeekdayDate,
  nextWorkDayLabel,
  longDate,
} from "./planningLogic";

export type TodayDashboardData = {
  tone: string;
  status: string;
  todayGroupLabel?: string;
  nextWork: Date | null;
  nextWorkExceptionalClosure?: boolean;
  nextWorkKind?: string | null;
  nextWorkGroupLabel?: string;
  nextWorkHalfLeaveLabel?: string;
  /** Accueil ou Billetterie, quand un poste est choisi ce jour-là. */
  nextWorkPostLabel?: string;
  /** Prochain férié travaillé, même l'année suivante. */
  nextWorkedHoliday?: { date: Date; name: string } | null;
};

/** « Ven 25/12 », et l'année quand le férié tombe l'année suivante. */
export function holidayDateLabel(date: Date, now: Date) {
  const label = compactWeekdayDate(date);
  return date.getFullYear() === now.getFullYear() ? label : `${label}/${date.getFullYear()}`;
}

/** « Aujourd’hui », « Demain » ou « Jeu 15/10 ». */
function extraWorkDate(key: string, now: Date) {
  const date = new Date(`${key}T12:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Aujourd’hui";
  return days === 1 ? "Demain" : holidayDateLabel(date, now);
}

/** « 19 h – 23 h », « 18 h 30 – 21 h ». */
function extraWorkHours(item: { start: string; end: string }) {
  const clock = (value: string) => value.replace(/^0(?=\d)/, "").replace(":00", " h").replace(":", " h ");
  return `${clock(item.start)} – ${clock(item.end)}`;
}

export type HomeSetupItem = {
  id: string;
  title: string;
  intro: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
  dismissible?: boolean;
};

type HomeDashboardProps = {
  now: Date;
  group: number;
  hasConfiguredGroup: boolean;
  today: TodayDashboardData;
  totalLeaveRemaining: number;
  /** Le prochain mécénat ou les prochaines heures sup, à partir d'aujourd'hui. */
  nextExtraWork: { kind: "mecenat" | "overtime"; date: string; start: string; end: string } | null;
  setupItems: HomeSetupItem[];
  setupDismissKey: string;
  hasAnyNote: boolean;
  noteQuery: string;
  onNoteQueryChange: Dispatch<SetStateAction<string>>;
  noteSearchResults: NoteListItem[];
  upcoming: NoteListItem[];
  renderNoteItems: (items: NoteListItem[], searching?: boolean) => ReactNode;
  onChooseGroup: () => void;
  onOpenNextWork: (date: Date) => void;
  onOpenLeave: () => void;
  onAddNote: () => void;
};

export function HomeDashboard({
  now,
  group,
  hasConfiguredGroup,
  today,
  totalLeaveRemaining,
  nextExtraWork,
  setupItems,
  setupDismissKey,
  hasAnyNote,
  noteQuery,
  onNoteQueryChange,
  noteSearchResults,
  upcoming,
  renderNoteItems,
  onChooseGroup,
  onOpenNextWork,
  onOpenLeave,
  onAddNote,
}: HomeDashboardProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [dismissedSetupItems, setDismissedSetupItems] = useState<string[]>(() => {
    try {
      if (typeof localStorage === "undefined") return [];
      const saved = JSON.parse(localStorage.getItem(setupDismissKey) || "[]");
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  /* Deux invitations au plus : au-delà, l'accueil redevient une liste de
     corvées qu'on fait défiler pour atteindre le calendrier. Les suivantes
     apparaissent quand les premières sont réglées ou écartées. */
  const visibleSetupItems = setupItems
    .filter((item) => !dismissedSetupItems.includes(item.id))
    .slice(0, 2);
  // Plusieurs manques d'une même rubrique partagent la même explication : la
  // répéter en tête vaut mieux qu'une phrase passe-partout.
  const sharedIntro = visibleSetupItems.every(
    (item) => item.intro === visibleSetupItems[0]?.intro,
  );
  const setupIntro = visibleSetupItems.length && sharedIntro
    ? visibleSetupItems[0].intro
    : "Plusieurs informations sont encore nécessaires pour adapter votre planning et vos calculs. Complétez les rubriques ci-dessous selon votre situation.";
  const dismissSetupItem = (id: string) => {
    setDismissedSetupItems((current) => {
      const next = [...new Set([...current, id])];
      if (typeof localStorage !== "undefined")
        localStorage.setItem(setupDismissKey, JSON.stringify(next));
      return next;
    });
  };
  const groupActionLabel = hasConfiguredGroup
    ? `Je suis groupe ${group}`
    : "Choisir mon groupe";
  // « Demain » se lit en toutes lettres ; une date, plus longue, s'écrit un
  // peu plus petit pour tenir sur la ligne.
  const nextWorkIsDate = Boolean(today.nextWork) && nextWorkDayLabel(today.nextWork!) !== "Demain";
  const nextWorkLabel = today.nextWork ? nextWorkDayLabel(today.nextWork) : "Aucun à venir";
  // Formation, fermeture ou demi-journée posée : sur une seconde ligne sous la
  // date, sans tiret qui resterait seul en bout de ligne.
  const nextWorkDetail = today.nextWork
    ? [
        today.nextWorkPostLabel || "",
        today.nextWorkExceptionalClosure
          ? "Fermeture exceptionnelle"
          : today.nextWorkKind === "training"
            ? "Formation"
            : "",
        today.nextWorkHalfLeaveLabel || "",
      ].filter(Boolean).join(" · ")
    : "";

  const chevron = (
    <svg className="today-block-go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  );

  return (
    <>
      <section className="today-overview" aria-labelledby="today-title">
        <div className="today-overview-heading">
          <div>
            <span className="step-label">En un coup d’œil</span>
            <h2 id="today-title">Aujourd’hui</h2>
            <small>{longDate(now)}</small>
          </div>
          <button
            className="primary-action add-action group-heading-action"
            type="button"
            onClick={onChooseGroup}
            aria-label={
              hasConfiguredGroup
                ? `Je suis groupe ${group}. Modifier mon groupe`
                : "Choisir mon groupe"
            }
          >
            {groupActionLabel}
          </button>
        </div>
        {/* Quatre blocs au même format : la journée d'abord, puis les trois
            compteurs. En lignes sur téléphone, en cartes sur ordinateur. */}
        <div className="today-blocks">
          <article className={`today-block today-status tone-${today.tone}`}>
            <span className="today-block-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="today-block-label">Aujourd’hui</span>
            <strong>{today.status}</strong>
            {today.todayGroupLabel ? <small className="today-block-note">{today.todayGroupLabel}</small> : null}
          </article>
          <button
            className="today-block today-next-work"
            type="button"
            onClick={() => today.nextWork && onOpenNextWork(today.nextWork)}
          >
            <span className="today-block-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                <path d="m9 14 2 2 4-4" />
              </svg>
            </span>
            <span className="today-block-label">Prochain jour travaillé</span>
            <strong className={nextWorkIsDate ? "is-date" : undefined}>
              {nextWorkLabel}
              {nextWorkDetail ? <span className="today-value-detail">{nextWorkDetail}</span> : null}
            </strong>
            {today.nextWorkGroupLabel ? <small className="today-block-note">{today.nextWorkGroupLabel}</small> : null}
            {chevron}
          </button>
          <button
            className="today-block today-leave-balance"
            type="button"
            onClick={onOpenLeave}
            aria-label={`Congés restants : ${totalLeaveRemaining.toLocaleString("fr-FR")} jours. Afficher le détail des soldes.`}
          >
            <span className="today-block-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                {/* Le même soleil sur la mer que la rubrique Congés du dock. */}
                <path d="M12 3.5v1.5M5.6 6.6l1.1 1.1M18.4 6.6l-1.1 1.1M3 13h2m14 0h2M8 13a4 4 0 0 1 8 0M3 17.5c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1" />
              </svg>
            </span>
            <span className="today-block-label">Congés restants</span>
            <strong>{totalLeaveRemaining.toLocaleString("fr-FR")} jour{Math.abs(totalLeaveRemaining) > 1 ? "s" : ""}</strong>
            <small className="today-block-note">à poser</small>
            {chevron}
          </button>
          {today.nextWorkedHoliday ? (
            <button
              className="today-block today-next-holiday"
              type="button"
              onClick={() => today.nextWorkedHoliday && onOpenNextWork(today.nextWorkedHoliday.date)}
            >
              <span className="today-block-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  {/* Une étoile : le jour férié sort de l'ordinaire. */}
                  <path d="m12 4 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.6 5.2-.6Z" />
                </svg>
              </span>
              <span className="today-block-label">Prochain férié travaillé</span>
              <strong className="is-date">{holidayDateLabel(today.nextWorkedHoliday.date, now)}</strong>
              <small className="today-block-note">{today.nextWorkedHoliday.name}</small>
              {chevron}
            </button>
          ) : null}
          <button
            className="today-block today-next-extra"
            type="button"
            onClick={onOpenLeave}
            aria-label={nextExtraWork
              ? `${nextExtraWork.kind === "overtime" ? "Prochaine heure sup" : "Prochain mécénat"} : ${extraWorkDate(nextExtraWork.date, now)}, ${extraWorkHours(nextExtraWork)}. Afficher les heures et mécénats.`
              : "Aucun mécénat ni heure sup à venir. Afficher les heures et mécénats."}
          >
            <span className="today-block-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                {/* Une horloge et un plus : du temps en plus du planning. */}
                <circle cx="11" cy="12" r="7.5" />
                <path d="M11 8v4l2.5 1.5M18.5 3.5v5m-2.5-2.5h5" />
              </svg>
            </span>
            <span className="today-block-label">{nextExtraWork?.kind === "overtime" ? "Prochaine heure sup" : nextExtraWork ? "Prochain mécénat" : "Mécénat ou heure sup"}</span>
            <strong className={nextExtraWork ? "is-date" : undefined}>
              {nextExtraWork ? extraWorkDate(nextExtraWork.date, now) : "Rien de prévu"}
            </strong>
            <small className="today-block-note">
              {nextExtraWork ? extraWorkHours(nextExtraWork) : "ni mécénat ni heure sup à venir"}
            </small>
            {chevron}
          </button>
        </div>
      </section>

      {visibleSetupItems.length ? (
        <section className="home-setup-alert" aria-labelledby="home-setup-title" aria-live="polite">
          <header>
            <span aria-hidden="true">!</span>
            <div><span className="step-label">Pour bien démarrer</span><h2 id="home-setup-title">Informations à compléter</h2></div>
          </header>
          <p>{setupIntro}</p>
          <div className="home-setup-list">
            {visibleSetupItems.map((item) => (
              <article key={item.id}>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                <span className="home-setup-actions">
                  <button type="button" onClick={item.onAction}>{item.actionLabel}<b aria-hidden="true">→</b></button>
                  {item.dismissible !== false ? <button className="home-setup-dismiss" type="button" onClick={() => dismissSetupItem(item.id)}>Ne plus me le demander</button> : null}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-notes-section" aria-labelledby="home-notes-title">
        {/* L'en-tête porte le bouton d'ajout, juste avant la flèche : on peut
            écrire une note sans déplier la liste. Les deux boutons partagent
            la même case de grille, l'ajout posé par-dessus le côté droit. */}
        <div className="home-notes-header">
          <button
            className="home-notes-toggle"
            type="button"
            aria-expanded={notesOpen}
            aria-controls="home-notes-content"
            onClick={() => setNotesOpen((open) => !open)}
          >
            <span>
              <span className="step-label">À ne pas oublier</span>
              <h2 id="home-notes-title">Mes notes</h2>
            </span>
            <b aria-hidden="true">⌄</b>
          </button>
          <button className="home-add-note" type="button" onClick={onAddNote}>Ajouter une note</button>
        </div>
        {notesOpen ? (
          <div id="home-notes-content" className="home-notes-content">
            <NotesPanelContent
              hasAnyNote={hasAnyNote}
              query={noteQuery}
              onQueryChange={onNoteQueryChange}
              searchResults={noteSearchResults}
              upcoming={upcoming}
              renderItems={renderNoteItems}
            />
          </div>
        ) : null}
      </section>
    </>
  );
}
