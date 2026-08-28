import type { Dispatch, ReactNode, SetStateAction } from "react";
import { dayCountLabel, type NoteListItem } from "./appModel";
import { NotesPanelContent } from "./PlanningView";
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
};

type HomeDashboardProps = {
  now: Date;
  group: number;
  hasConfiguredGroup: boolean;
  today: TodayDashboardData;
  totalLeaveRemaining: number;
  remainingWorkedDaysThisYear: number;
  importantAlert: string;
  hasAnyNote: boolean;
  noteQuery: string;
  onNoteQueryChange: Dispatch<SetStateAction<string>>;
  noteSearchResults: NoteListItem[];
  upcoming: NoteListItem[];
  renderNoteItems: (items: NoteListItem[]) => ReactNode;
  onChooseGroup: () => void;
  onOpenNextWork: (date: Date) => void;
  onOpenLeave: () => void;
  onOpenPayAlert: () => void;
  onAddNote: () => void;
};

export function HomeDashboard({
  now,
  group,
  hasConfiguredGroup,
  today,
  totalLeaveRemaining,
  remainingWorkedDaysThisYear,
  importantAlert,
  hasAnyNote,
  noteQuery,
  onNoteQueryChange,
  noteSearchResults,
  upcoming,
  renderNoteItems,
  onChooseGroup,
  onOpenNextWork,
  onOpenLeave,
  onOpenPayAlert,
  onAddNote,
}: HomeDashboardProps) {
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
      }`
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
            aria-label={`Congés restant : ${totalLeaveRemaining.toLocaleString("fr-FR")} jours. Afficher le détail des soldes.`}
          >
            <span className="today-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
                <path d="M8 13h8M8 17h5" />
              </svg>
            </span>
            <span className="today-card-copy">
              <span>Congés restant :</span>
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
        {importantAlert ? (
          <button className="important-alert" type="button" onClick={onOpenPayAlert}>
            <span aria-hidden="true">!</span>
            <strong>{importantAlert}</strong>
            <small>Voir dans Ma paie</small>
          </button>
        ) : null}
      </section>

      <section className="home-notes-section" aria-labelledby="home-notes-title">
        <div className="home-content-heading">
          <div>
            <span className="step-label">À ne pas oublier</span>
            <h2 id="home-notes-title">Mes notes</h2>
          </div>
          <button type="button" onClick={onAddNote}>Ajouter une note</button>
        </div>
        <NotesPanelContent
          hasAnyNote={hasAnyNote}
          query={noteQuery}
          onQueryChange={onNoteQueryChange}
          searchResults={noteSearchResults}
          upcoming={upcoming}
          renderItems={renderNoteItems}
        />
      </section>
    </>
  );
}
