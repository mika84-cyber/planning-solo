import { Suspense } from "react";
import {
  ColleaguePlanningPage,
  GrandPalaisProgramSection,
  UsefulContactsSection,
  UsefulFormsSection,
} from "./appSections";
import { presenceShownToColleagues } from "./appModel";
import { DeferredSection } from "./DeferredSection";
import { usableWorkSchedule } from "./overtime";
import { dateKey } from "./planningLogic";
import { UsefulResourcesHub } from "./UsefulResourcesHub";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useCalendarDataState } from "./useCalendarDataState";
import type { usePayProfileValues } from "./usePayProfileValues";
import type { useWorkAccidentActions } from "./useWorkAccidentActions";

type AppShellUi = ReturnType<typeof useAppShellUiState>;

type Props = {
  now: Date;
  group: number;
  demoMode: boolean;
  userEmail: string;
  isProgramAdmin: boolean;
  /** L'administrateur regarde l'application comme un invité. */
  guestPreview: boolean;
  /** Change à chaque modification faite dans les outils d'administration :
   *  les rubriques relisent alors leurs données. */
  adminRevision: number;
  shell: Pick<AppShellUi, "homeSection" | "prefetchedContacts">;
  calendar: Pick<ReturnType<typeof useCalendarDataState>, "periods" | "entries" | "recoveryUses" | "formProfile">;
  workDayMinutes: ReturnType<typeof usePayProfileValues>["workDayMinutes"];
  /** Fermeture exceptionnelle d'un jour, s'il y en a une. */
  exceptionalClosureFor: (key: string) => unknown;
  workAccident: ReturnType<typeof useWorkAccidentActions>;
};

/**
 * Les rubriques qui lisent des ressources partagées : Documents et contacts
 * (formulaires, annuaire), la programmation GP et les plannings des collègues.
 * Chacune se charge à part ; ce composant les relie aux états d'App.tsx.
 */
export function DocumentsSectionScreen({
  now, group, demoMode, userEmail, isProgramAdmin, guestPreview, adminRevision,
  shell, calendar, workDayMinutes, exceptionalClosureFor, workAccident,
}: Props) {
  const { homeSection, prefetchedContacts } = shell;
  const { periods, entries, recoveryUses, formProfile } = calendar;
  const { saveWorkAccident, deleteWorkAccident } = workAccident;
  return (
    <>
      {homeSection === "pdf" || homeSection === "forms" ? (
        <Suspense fallback={<DeferredSection label="vos contacts et formulaires" />}>
        <UsefulResourcesHub
          forms={(
            <UsefulFormsSection
              key={adminRevision}
              accountId={userEmail}
              isAdmin={isProgramAdmin}
              demoMode={demoMode}
              today={dateKey(now)}
              periods={periods}
              onSaveWorkAccident={saveWorkAccident}
              onDeleteWorkAccident={deleteWorkAccident}
            />
          )}
          contacts={<UsefulContactsSection key={adminRevision} accountId={userEmail} initialData={adminRevision ? undefined : prefetchedContacts || undefined} isAdmin={isProgramAdmin} demoMode={demoMode} />}
        />
        </Suspense>
      ) : null}
      {homeSection === "program" ? (
        <Suspense fallback={<DeferredSection label="la programmation GP" />}>
          <GrandPalaisProgramSection guestPreview={guestPreview} isAdmin={isProgramAdmin} />
        </Suspense>
      ) : null}
      {homeSection === "colleagues" ? (
        <Suspense fallback={<DeferredSection label="les plannings de vos collègues" />}>
          <ColleaguePlanningPage
            key={adminRevision}
            demoMode={demoMode}
            initialName={formProfile?.fullName || ""}
            accountId={userEmail}
            ownGroup={group}
            isAdmin={isProgramAdmin}
            getOwnPresence={(date) => presenceShownToColleagues(date, group, periods, entries, recoveryUses, workDayMinutes, (key) => Boolean(exceptionalClosureFor(key)), usableWorkSchedule(formProfile?.workSchedule))}
          />
        </Suspense>
      ) : null}
    </>
  );
}
