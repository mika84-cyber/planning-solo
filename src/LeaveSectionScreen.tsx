import { type Dispatch, lazy, type SetStateAction, Suspense } from "react";
import { CetSection, LeaveBalancesSection, LeaveManagementPage } from "./appSections";
import type { BalanceType } from "./appModel";
import { DeferredSection } from "./DeferredSection";
import { type CountedOnlyType, dateKey } from "./planningLogic";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useCalendarDataState } from "./useCalendarDataState";
import type { useLeaveBalances } from "./useLeaveBalances";
import type { useMonthPayEstimate } from "./useMonthPayEstimate";
import type { usePayUiState } from "./usePayUiState";
import type { usePlanningInteractionActions } from "./usePlanningInteractionActions";
import type { usePlanningRequestActions } from "./usePlanningRequestActions";
import type { useProfileAdjustmentActions } from "./useProfileAdjustmentActions";
import type { useRequestArchive } from "./useRequestArchive";
import type { useWorkTimeActions } from "./useWorkTimeActions";
import type { useWorkTimeUiState } from "./useWorkTimeUiState";

const LongAbsenceNotice = lazy(() => import("./LongAbsenceNotice").then((module) => ({ default: module.LongAbsenceNotice })));

type CalendarData = ReturnType<typeof useCalendarDataState>;

type Props = {
  now: Date;
  group: number;
  isProgramAdmin: boolean;
  savingCet: boolean;
  calendar: Pick<CalendarData, "periods" | "formProfile" | "overtimeEntries" | "mecenatEntries" | "recoveryUses">;
  /** Soldes de l'année choisie, CET compris, et l'année elle-même. */
  balances: Pick<
    ReturnType<typeof useLeaveBalances>,
    "leaveStats" | "manualSundayLeaveTotal" | "totalLeaveRemaining" | "cetLeaveBalances" | "cetAnnualDaysTaken" | "cetPlannedLeaveDays"
  > & {
    absenceYear: number;
    setAbsenceYear: Dispatch<SetStateAction<number>>;
    setBalanceDetailType: Dispatch<SetStateAction<BalanceType | CountedOnlyType | null>>;
  };
  /** Heures de récupération : solde, acquis et leur état. */
  recovery: Pick<
    ReturnType<typeof useMonthPayEstimate>,
    "recoveryBalance" | "paidOvertimeForPayPeriod" | "recoveryEarnings" | "unresolvedHolidayRecoveryCount" | "holidayRecoveryEarnings" | "recoveryEarningStates"
  >;
  workTime: Pick<
    ReturnType<typeof useWorkTimeUiState>,
    | "setOvertimeDraft" | "setOvertimeDialogOpen" | "setSolidarityDraft" | "setSolidarityDialogOpen"
    | "overtimeHistoryOpen" | "setOvertimeHistoryOpen" | "setMecenatDraft" | "setMecenatDialogOpen"
    | "mecenatHistoryOpen" | "setMecenatHistoryOpen"
  >;
  archive: Pick<
    ReturnType<typeof useRequestArchive>,
    "archiveOpen" | "setArchiveOpen" | "archivedRequests" | "openArchivedRequest" | "deleteArchivedRequest"
  >;
  shell: Pick<ReturnType<typeof useAppShellUiState>, "setHomeSection">;
  pay: Pick<ReturnType<typeof usePayUiState>, "setPayScreen">;
  actions: Pick<ReturnType<typeof useWorkTimeActions>, "deleteOvertimeEntry" | "deleteRecoveryUse" | "deleteMecenatEntry">
    & Pick<ReturnType<typeof usePlanningRequestActions>, "openBlankForm">
    & Pick<ReturnType<typeof usePlanningInteractionActions>, "beginRequest">
    & Pick<ReturnType<typeof useProfileAdjustmentActions>, "openManualAdjustments" | "saveCetAccount">
    & { openRequestChooser: (origin: "general" | "planning") => void };
};

/**
 * La rubrique Congés : la page des congés et récupérations, ses soldes, le CET,
 * les heures et l'archive des demandes. Les états et les actions restent dans
 * App.tsx ; ce composant les relie à la page.
 */
export function LeaveSectionScreen({
  now, group, isProgramAdmin, savingCet, calendar, balances, recovery, workTime, archive, shell, pay, actions,
}: Props) {
  const { periods, formProfile, overtimeEntries, mecenatEntries, recoveryUses } = calendar;
  const {
    leaveStats, manualSundayLeaveTotal, totalLeaveRemaining, cetLeaveBalances, cetAnnualDaysTaken, cetPlannedLeaveDays,
    absenceYear, setAbsenceYear, setBalanceDetailType,
  } = balances;
  const {
    recoveryBalance, paidOvertimeForPayPeriod, recoveryEarnings, unresolvedHolidayRecoveryCount,
    holidayRecoveryEarnings, recoveryEarningStates,
  } = recovery;
  const {
    setOvertimeDraft, setOvertimeDialogOpen, setSolidarityDraft, setSolidarityDialogOpen,
    overtimeHistoryOpen, setOvertimeHistoryOpen, setMecenatDraft, setMecenatDialogOpen,
    mecenatHistoryOpen, setMecenatHistoryOpen,
  } = workTime;
  const { archiveOpen, setArchiveOpen, archivedRequests, openArchivedRequest, deleteArchivedRequest } = archive;
  const { setHomeSection } = shell;
  const { setPayScreen } = pay;
  const {
    openRequestChooser, openBlankForm, beginRequest, openManualAdjustments, saveCetAccount,
    deleteOvertimeEntry, deleteRecoveryUse, deleteMecenatEntry,
  } = actions;
  return (
        <Suspense fallback={<DeferredSection label="vos congés et récupérations" />}>
        <LeaveManagementPage
          onRequestLeave={() => openRequestChooser("general")}
          onOpenBlankForm={openBlankForm}
          onOpenHolidayAllowances={() => {
            setHomeSection("pay");
            setPayScreen("allowances");
          }}
          longAbsenceContent={
            <Suspense fallback={null}>
            <LongAbsenceNotice
              periods={periods}
              group={group}
              todayKey={dateKey(now)}
              sender={{ fullName: formProfile?.fullName || "" }}
            />
            </Suspense>
          }
          balancesContent={
            <Suspense fallback={<DeferredSection label="vos soldes" />}>
              <LeaveBalancesSection
                year={absenceYear}
                totalRemaining={totalLeaveRemaining}
                balances={leaveStats.balances}
                countedOnly={leaveStats.countedOnly}
                manualSundayLeaveTotal={manualSundayLeaveTotal}
                onYearChange={(year) => {
                  setAbsenceYear(year);
                  setBalanceDetailType(null);
                }}
                onSelectBalance={setBalanceDetailType}
                onOpenManualAdjustments={openManualAdjustments}
              />
            </Suspense>
          }
          cetContent={
            <Suspense fallback={<DeferredSection label="votre CET" />}>
              <CetSection
                account={formProfile?.cetAccount}
                status={formProfile?.status || "contractuel"}
                fullName={formProfile?.fullName || ""}
                signature={formProfile?.signature || ""}
                annualDaysTaken={cetAnnualDaysTaken}
                plannedLeaveDays={cetPlannedLeaveDays}
                remaining={cetLeaveBalances}
                saving={savingCet}
                onSave={saveCetAccount}
                onRequestLeave={() => beginRequest("leave", undefined, "cet")}
              />
            </Suspense>
          }
          recoveryBalance={recoveryBalance}
          paidOvertimeEstimate={(year, month) => paidOvertimeForPayPeriod(year, month)}
          recoveryEarningsCount={recoveryEarnings.length}
          unresolvedHolidayRecoveryCount={unresolvedHolidayRecoveryCount}
          overtimeEntries={overtimeEntries}
          holidayRecoveryEarnings={holidayRecoveryEarnings}
          recoveryUses={recoveryUses}
          recoveryEarningStates={recoveryEarningStates}
          overtimeHistoryOpen={overtimeHistoryOpen}
          mecenatEntries={mecenatEntries}
          mecenatHistoryOpen={mecenatHistoryOpen}
          isProgramAdmin={isProgramAdmin}
          archiveOpen={archiveOpen}
          archivedRequests={archivedRequests}
          onOpenOvertime={() => {
            // La fenêtre s'ouvre vide, comme celle du mécénat.
            setOvertimeDraft({ date: "", start: "", end: "", disposition: "" });
            setOvertimeDialogOpen(true);
          }}
          onOpenSolidarity={() => {
            // Toujours un solde déjà calculé, majoration comprise.
            setSolidarityDraft((current) => ({ ...current, basis: "credited" }));
            setSolidarityDialogOpen(true);
          }}
          onToggleOvertimeHistory={() => setOvertimeHistoryOpen((current) => !current)}
          onDeleteOvertime={(entry) => void deleteOvertimeEntry(entry)}
          onDeleteRecoveryUse={(entry) => void deleteRecoveryUse(entry)}
          onOpenMecenat={() => {
            // La fenêtre s'ouvre vide : ni date ni horaires préremplis.
            setMecenatDraft({ date: "", start: "", end: "" });
            setMecenatDialogOpen(true);
          }}
          onToggleMecenatHistory={() => setMecenatHistoryOpen((current) => !current)}
          onDeleteMecenat={(entry) => void deleteMecenatEntry(entry)}
          onToggleArchive={() => setArchiveOpen((current) => !current)}
          onOpenArchivedRequest={openArchivedRequest}
          onDeleteArchivedRequest={(request) => void deleteArchivedRequest(request)}
        />
        </Suspense>
  );
}
