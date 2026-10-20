import { lazy, Suspense } from "react";
import { DeferredSection } from "./DeferredSection";
import { UpcomingNoteList } from "./UpcomingNoteList";
import { localDate } from "./planningLogic";
import { scrollWhenReady } from "./scrollWhenReady";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useCalendarDataState } from "./useCalendarDataState";
import type { useLeaveBalances } from "./useLeaveBalances";
import type { useNoteLists } from "./useNoteLists";
import type { usePartnerNoteActions } from "./usePartnerNoteActions";
import type { usePayUiState } from "./usePayUiState";
import type { usePlanningEntryActions } from "./usePlanningEntryActions";
import type { usePlanningInteractionActions } from "./usePlanningInteractionActions";
import type { useWorkedDaysOverview } from "./useWorkedDaysOverview";

// Le tableau d'accueil : son chargement part dès ce module, pour que la
// première rubrique s'affiche sans attendre.
const homeDashboardModule = import("./HomeDashboard");
const HomeDashboard = lazy(() =>
  homeDashboardModule.then(({ HomeDashboard: Component }) => ({ default: Component })),
);

type CalendarData = ReturnType<typeof useCalendarDataState>;

type Props = {
  now: Date;
  group: number;
  demoMode: boolean;
  userEmail: string;
  isProgramAdmin: boolean;
  formProfile: CalendarData["formProfile"];
  entries: CalendarData["entries"];
  ownNoteAuthorLabel: string;
  /** Ce que l'accueil montre du jour, des congés et des notes. */
  overview: Pick<ReturnType<typeof useWorkedDaysOverview>, "todayOverview" | "nextExtraWork">
    & Pick<ReturnType<typeof useNoteLists>, "upcoming" | "hasAnyNote" | "noteSearchResults">
    & Pick<ReturnType<typeof useLeaveBalances>, "totalLeaveRemaining">;
  /** Ce qui reste à renseigner dans les premières étapes. */
  setup: {
    missingCalculationProfile: boolean;
    missingHolidayChoices: number;
    missingPayValues: boolean;
  };
  shell: Pick<
    ReturnType<typeof useAppShellUiState>,
    "noteQuery" | "setNoteQuery" | "setHomeSection" | "setGroupChooserOpen"
  >;
  pay: Pick<
    ReturnType<typeof usePayUiState>,
    "setPayScreen" | "setPayProfileOpen" | "setPayAdvancedOpen" | "setPayProfileFocusRequested" | "setPayVerificationRequested"
  >;
  actions: Pick<ReturnType<typeof usePlanningInteractionActions>, "openDay" | "beginQuickNote">
    & Pick<ReturnType<typeof usePlanningEntryActions>, "deleteMultiplePlanningDates">
    & Pick<ReturnType<typeof usePartnerNoteActions>, "deleteAgnesNote">
    & { setView: (date: Date) => void };
};

/**
 * La rubrique Accueil : le tableau de bord « en un coup d'œil », les premières
 * étapes à compléter et les notes à venir. Les états et les actions restent
 * dans App.tsx ; ce composant les relie au tableau d'accueil.
 */
export function HomeSectionScreen({
  now, group, demoMode, userEmail, isProgramAdmin, formProfile, entries, ownNoteAuthorLabel,
  overview, setup, shell, pay, actions,
}: Props) {
  const { setHomeSection, setGroupChooserOpen } = shell;
  const { setPayScreen } = pay;
  const { missingCalculationProfile, missingHolidayChoices, missingPayValues } = setup;
  const { setView, openDay } = actions;
  return (
        <Suspense fallback={<DeferredSection label="votre accueil" />}>
        <HomeDashboard
          now={now}
          group={group}
          hasConfiguredGroup={Boolean(formProfile?.group)}
          today={overview.todayOverview}
          totalLeaveRemaining={overview.totalLeaveRemaining}
          nextExtraWork={overview.nextExtraWork}
          setupDismissKey={`planning:setup-dismissed-v1:${demoMode ? "demo" : userEmail.trim().toLowerCase()}`}
          setupItems={[
            {
              id: "planning-group",
              title: "Groupe de planning",
              detail: formProfile?.group ? `Groupe ${group}` : "Jours de travail et de repos",
              done: Boolean(formProfile?.group),
              onAction: () => setGroupChooserOpen(true),
            },
            {
              id: "pay-profile",
              title: "Profil de calcul",
              detail: missingCalculationProfile ? "Statut et quotité" : "Statut et quotité renseignés",
              done: !missingCalculationProfile,
              onAction: () => {
                setHomeSection("pay");
                setPayScreen("overview");
                pay.setPayProfileOpen(true);
                pay.setPayAdvancedOpen(false);
                pay.setPayProfileFocusRequested(true);
              },
            },
            {
              id: "holiday-choice",
              title: `Jours fériés ${now.getFullYear()}`,
              detail: missingHolidayChoices
                ? `${missingHolidayChoices} à choisir`
                : "Tous choisis",
              done: !missingHolidayChoices,
              onAction: () => {
                setHomeSection("pay");
                setPayScreen("allowances");
                scrollWhenReady("holiday-choices");
              },
            },
            {
              id: "payslip-upload",
              title: "Bulletin de paie",
              detail: missingPayValues ? "Lu tout seul" : "Valeurs enregistrées",
              done: !missingPayValues,
              onAction: () => {
                setHomeSection("pay");
                setPayScreen("overview");
                pay.setPayVerificationRequested(true);
              },
            },
          ]}
          hasAnyNote={overview.hasAnyNote}
          noteQuery={shell.noteQuery}
          onNoteQueryChange={shell.setNoteQuery}
          noteSearchResults={overview.noteSearchResults}
          upcoming={overview.upcoming}
          renderNoteItems={(items, searching) => (
            <UpcomingNoteList
              items={items}
              monthsOpen={searching}
              authorColors={isProgramAdmin}
              entries={entries}
              ownNoteAuthorLabel={ownNoteAuthorLabel}
              onOpenDate={(date) => {
                setView(localDate(date.getFullYear(), date.getMonth(), 1));
                openDay(date);
              }}
              onDeleteOwnNotes={(dates) => void actions.deleteMultiplePlanningDates(dates, "notes")}
              onDeleteAgnesNote={(date) => void actions.deleteAgnesNote(date)}
            />
          )}
          onChooseGroup={() => setGroupChooserOpen(true)}
          onOpenNextWork={(date) => {
            // Le prochain jour travaillé s'ouvre directement sur sa fiche,
            // dans son mois : changer seulement de mois ne montrait rien quand
            // ce mois était déjà affiché.
            setHomeSection("home");
            setView(localDate(date.getFullYear(), date.getMonth(), 1));
            openDay(date);
          }}
          onOpenLeave={() => setHomeSection("leave")}
          onAddNote={actions.beginQuickNote}
        />
        </Suspense>
  );
}
