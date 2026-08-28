import type { ComponentProps } from "react";
import { DataManagementDialog } from "./DataManagementDialog";
import { ManualAdjustmentsDialog, RangeLeaveDialog } from "./LeaveDialogs";
import {
  AppUpdateDialog,
  DeletePeriodDialog,
  MessageDialog,
  NonWorkingDayWarningDialog,
  SuccessToast,
  TimeSelectionDialog,
  UndoToast,
} from "./PlanningDialogs";
import {
  MecenatDialog,
  OvertimeDialog,
  RecoveryRangeDialog,
  RecoveryUseDialog,
  SolidarityHoursDialog,
} from "./WorkTimeDialogs";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { usePlanningUiState } from "./usePlanningUiState";
import type { useToast } from "./useToast";
import type { RecoveryDraft, useWorkTimeUiState } from "./useWorkTimeUiState";

type PlanningDialogsState = Pick<
  ReturnType<typeof usePlanningUiState>,
  | "rangeOpen"
  | "setRangeOpen"
  | "rangeLeaveType"
  | "setRangeLeaveType"
  | "rangeHalfMoment"
  | "setRangeHalfMoment"
  | "timeDate"
  | "setTimeDate"
  | "activeType"
  | "timeStart"
  | "setTimeStart"
  | "timeEnd"
  | "setTimeEnd"
  | "warningDate"
  | "setWarningDate"
  | "deletingPeriod"
  | "setDeletingPeriod"
  | "savingRange"
  | "recoveryRangeOpen"
>;

type WorkTimeDialogsState = Pick<
  ReturnType<typeof useWorkTimeUiState>,
  | "mecenatDialogOpen"
  | "setMecenatDialogOpen"
  | "mecenatDraft"
  | "setMecenatDraft"
  | "savingMecenat"
  | "overtimeDialogOpen"
  | "setOvertimeDialogOpen"
  | "overtimeDraft"
  | "setOvertimeDraft"
  | "solidarityDialogOpen"
  | "setSolidarityDialogOpen"
  | "solidarityDraft"
  | "setSolidarityDraft"
  | "savingOvertime"
  | "recoveryDialogOpen"
  | "setRecoveryDialogOpen"
  | "recoveryDraft"
  | "setRecoveryDraft"
  | "recoveryCalendarVisible"
>;

type ShellDialogsState = Pick<
  ReturnType<typeof useAppShellUiState>,
  | "appUpdatePromptOpen"
  | "setAppUpdatePromptOpen"
  | "checkingAppUpdate"
  | "dataManagementOpen"
  | "setDataManagementOpen"
  | "dataManagementBusy"
>;

type ToastDialogsState = Pick<
  ReturnType<typeof useToast>,
  | "message"
  | "dismiss"
  | "successMessage"
  | "dismissSuccess"
  | "undoOffer"
  | "runUndo"
  | "dismissUndo"
>;

type Props = {
  manualAdjustments: ComponentProps<typeof ManualAdjustmentsDialog>;
  planning: PlanningDialogsState;
  workTime: WorkTimeDialogsState;
  shell: ShellDialogsState;
  toast: ToastDialogsState;
  group: number;
  mecenatCalculation: ComponentProps<typeof MecenatDialog>["calculation"];
  recoveryRemainingMinutes: number;
  onStartRangeSelection: () => void;
  onSaveMecenat: () => void;
  onSaveOvertime: () => void;
  onSaveSolidarityHours: () => void;
  onChangeRecoveryRangeKind: (kind: RecoveryDraft["kind"]) => void;
  onCloseRecoveryRange: () => void;
  onStartRecoveryRangeSelection: () => void;
  onSelectRecoveryInCalendar: () => void;
  onSaveRecoveryUse: () => void;
  onConfirmTime: () => void;
  onConfirmNonWorkingDay: () => void;
  onDeletePeriod: () => void;
  onCheckForUpdate: () => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  onArchiveLegacyData: () => void;
  onDeleteAllData: () => void;
};

/**
 * Couche de présentation des modales globales.
 *
 * Les calculs et mutations restent dans App ; ce composant ne fait que relier
 * les états d'interface aux dialogues spécialisés déjà testés.
 */
export function AppDialogLayer({
  manualAdjustments,
  planning,
  workTime,
  shell,
  toast,
  group,
  mecenatCalculation,
  recoveryRemainingMinutes,
  onStartRangeSelection,
  onSaveMecenat,
  onSaveOvertime,
  onSaveSolidarityHours,
  onChangeRecoveryRangeKind,
  onCloseRecoveryRange,
  onStartRecoveryRangeSelection,
  onSelectRecoveryInCalendar,
  onSaveRecoveryUse,
  onConfirmTime,
  onConfirmNonWorkingDay,
  onDeletePeriod,
  onCheckForUpdate,
  onExportData,
  onImportData,
  onArchiveLegacyData,
  onDeleteAllData,
}: Props) {
  return (
    <>
      <ManualAdjustmentsDialog {...manualAdjustments} />

      <RangeLeaveDialog
        open={planning.rangeOpen}
        leaveType={planning.rangeLeaveType}
        setLeaveType={planning.setRangeLeaveType}
        halfMoment={planning.rangeHalfMoment}
        setHalfMoment={planning.setRangeHalfMoment}
        onClose={() => planning.setRangeOpen(false)}
        onStartSelection={onStartRangeSelection}
      />

      <MecenatDialog
        open={workTime.mecenatDialogOpen}
        draft={workTime.mecenatDraft}
        setDraft={workTime.setMecenatDraft}
        calculation={mecenatCalculation}
        saving={workTime.savingMecenat}
        onClose={() => workTime.setMecenatDialogOpen(false)}
        onSave={onSaveMecenat}
      />

      <OvertimeDialog
        open={workTime.overtimeDialogOpen}
        draft={workTime.overtimeDraft}
        setDraft={workTime.setOvertimeDraft}
        saving={workTime.savingOvertime}
        group={group}
        onClose={() => workTime.setOvertimeDialogOpen(false)}
        onSave={onSaveOvertime}
      />

      <SolidarityHoursDialog
        open={workTime.solidarityDialogOpen}
        draft={workTime.solidarityDraft}
        setDraft={workTime.setSolidarityDraft}
        saving={workTime.savingOvertime}
        onClose={() => workTime.setSolidarityDialogOpen(false)}
        onSave={onSaveSolidarityHours}
      />

      <RecoveryRangeDialog
        open={planning.recoveryRangeOpen}
        kind={workTime.recoveryDraft.kind}
        setKind={onChangeRecoveryRangeKind}
        onClose={onCloseRecoveryRange}
        onStartSelection={onStartRecoveryRangeSelection}
      />

      <RecoveryUseDialog
        open={workTime.recoveryDialogOpen}
        draft={workTime.recoveryDraft}
        setDraft={workTime.setRecoveryDraft}
        group={group}
        showCalendar={workTime.recoveryCalendarVisible}
        remainingMinutes={recoveryRemainingMinutes}
        saving={workTime.savingOvertime}
        onClose={() => workTime.setRecoveryDialogOpen(false)}
        onSelectInCalendar={onSelectRecoveryInCalendar}
        onSave={onSaveRecoveryUse}
      />

      <TimeSelectionDialog
        date={planning.timeDate}
        activeType={planning.activeType}
        start={planning.timeStart}
        end={planning.timeEnd}
        onStartChange={planning.setTimeStart}
        onEndChange={planning.setTimeEnd}
        onClose={() => planning.setTimeDate(null)}
        onConfirm={onConfirmTime}
      />
      <NonWorkingDayWarningDialog
        date={planning.warningDate}
        group={group}
        onCancel={() => planning.setWarningDate(null)}
        onConfirm={onConfirmNonWorkingDay}
      />
      <DeletePeriodDialog
        period={planning.deletingPeriod}
        saving={planning.savingRange}
        onCancel={() => planning.setDeletingPeriod(null)}
        onConfirm={onDeletePeriod}
      />

      <MessageDialog message={toast.message} onClose={toast.dismiss} />
      <AppUpdateDialog
        open={shell.appUpdatePromptOpen}
        checking={shell.checkingAppUpdate}
        onLater={() => shell.setAppUpdatePromptOpen(false)}
        onUpdate={onCheckForUpdate}
      />
      <SuccessToast message={toast.successMessage} onClose={toast.dismissSuccess} />
      <UndoToast
        message={toast.undoOffer?.message || null}
        onUndo={toast.runUndo}
        onClose={toast.dismissUndo}
      />
      <DataManagementDialog
        open={shell.dataManagementOpen}
        busy={shell.dataManagementBusy}
        onClose={() => shell.setDataManagementOpen(false)}
        onExport={onExportData}
        onImport={onImportData}
        onArchiveLegacy={onArchiveLegacyData}
        onDeleteAll={onDeleteAllData}
      />
    </>
  );
}
