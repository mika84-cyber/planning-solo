import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { dayCountLabel, type NoteListItem } from "./appModel";
import { NotesPanelContent } from "./PlanningView";
import "./sharedNotes.css";
import {
  compactWeekdayDate,
  longDate,
  s,
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
};

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
  remainingWorkedDaysThisYear: number;
  setupItems: HomeSetupItem[];
  setupDismissKey: string;
  hasAnyNote: boolean;
  noteQuery: string;
  onNoteQueryChange: Dispatch<SetStateAction<string>>;
  noteSearchResults: NoteListItem[];
  upcoming: NoteListItem[];
  renderNoteItems: (items: NoteListItem[]) => ReactNode;
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
  remainingWorkedDaysThisYear,
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
  const visibleSetupItems = setupItems.filter((item) => !dismissedSetupItems.includes(item.id));
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
  const nextWorkLabel = today.nextWork
    ? `${compactWeekdayDate(today.nextWork)}${
        today.nextWorkExceptionalClosure
          ? " — Fermeture exceptionnelle"
          : today.nextWorkKind === "training"
            ? " — Formation"
            : ""
      }${today.nextWorkHalfLeaveLabel ? ` — ${today.nextWorkHalfLeaveLabel}` : ""}`
    : "Aucun à venir";

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
        <div className="today-overview-grid">
          <article className={`today-status tone-${today.tone}`}>
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Aujourd’hui</span>
              <strong>{today.status}</strong>
              {today.todayGroupLabel ? <small>{today.todayGroupLabel}</small> : null}
            </span>
          </article>
          <button
            className="today-next-work"
            type="button"
            onClick={() => today.nextWork && onOpenNextWork(today.nextWork)}
          >
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                <path d="m9 14 2 2 4-4" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Prochain jour travaillé</span>
              <strong>{nextWorkLabel}</strong>
              {today.nextWorkGroupLabel ? <small>{today.nextWorkGroupLabel}</small> : null}
            </span>
          </button>
          <button
            className="today-leave-balance"
            type="button"
            onClick={onOpenLeave}
            aria-label={`Congés restants : ${totalLeaveRemaining.toLocaleString("fr-FR")} jours. Afficher le détail des soldes.`}
          >
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                <path d="M8 13h8M8 17h5" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Congés restants :</span>
              <strong>{totalLeaveRemaining.toLocaleString("fr-FR")} jours à poser</strong>
              <small>Voir le détail des soldes</small>
            </span>
          </button>
          <article className="today-remaining-work">
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                <path d="m8 14 2.5 2.5L16 11" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Travail restant</span>
              <strong>
                {dayCountLabel(remainingWorkedDaysThisYear)} jour
                {s(remainingWorkedDaysThisYear)}
              </strong>
              <small>D’ici au 31 décembre</small>
            </span>
          </article>
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
        {notesOpen ? (
          <div id="home-notes-content" className="home-notes-content">
            <button className="home-add-note" type="button" onClick={onAddNote}>Ajouter une note</button>
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
