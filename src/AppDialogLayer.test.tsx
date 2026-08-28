import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppDialogLayer } from "./AppDialogLayer";

const noop = vi.fn();

const baseProps = {
  manualAdjustments: {
    open: false,
    year: 2026,
    draft: {
      annualUsed: "0",
      rttUsed: "0",
      fractionUsed: "0",
      sundayLeaveJanJun: "0",
      sundayLeaveJulSep: "0",
      sundayLeaveOctNov: "0",
      sundayLeaveDec: "0",
    },
    setDraft: noop,
    saving: false,
    onClose: noop,
    onSave: noop,
  },
  planning: {
    rangeOpen: false,
    setRangeOpen: noop,
    rangeLeaveType: "annual" as const,
    setRangeLeaveType: noop,
    rangeHalfMoment: "morning" as const,
    setRangeHalfMoment: noop,
    timeDate: null,
    setTimeDate: noop,
    activeType: "annual" as const,
    timeStart: "09:15",
    setTimeStart: noop,
    timeEnd: "13:00",
    setTimeEnd: noop,
    warningDate: null,
    setWarningDate: noop,
    deletingPeriod: null,
    setDeletingPeriod: noop,
    savingRange: false,
    recoveryRangeOpen: false,
  },
  workTime: {
    mecenatDialogOpen: false,
    setMecenatDialogOpen: noop,
    mecenatDraft: { date: "2026-08-29", start: "19:00", end: "00:00" },
    setMecenatDraft: noop,
    savingMecenat: false,
    overtimeDialogOpen: false,
    setOvertimeDialogOpen: noop,
    overtimeDraft: {
      date: "2026-08-29",
      start: "18:00",
      end: "20:00",
      disposition: "paid" as const,
    },
    setOvertimeDraft: noop,
    solidarityDialogOpen: false,
    setSolidarityDialogOpen: noop,
    solidarityDraft: { hours: "", minutes: "0" },
    setSolidarityDraft: noop,
    savingOvertime: false,
    recoveryDialogOpen: false,
    setRecoveryDialogOpen: noop,
    recoveryDraft: {
      date: "2026-08-29",
      kind: "hours" as const,
      hours: "2",
      minutes: "0",
      start: "",
      durationMinutes: 480,
      trainingMinutes: 360 as const,
    },
    setRecoveryDraft: noop,
    recoveryCalendarVisible: true,
  },
  shell: {
    appUpdatePromptOpen: false,
    setAppUpdatePromptOpen: noop,
    checkingAppUpdate: false,
    dataManagementOpen: false,
    setDataManagementOpen: noop,
    dataManagementBusy: false,
  },
  toast: {
    message: null,
    dismiss: noop,
    successMessage: null,
    dismissSuccess: noop,
    undoOffer: null,
    runUndo: noop,
    dismissUndo: noop,
  },
  group: 2,
  mecenatCalculation: null,
  recoveryRemainingMinutes: 0,
  onStartRangeSelection: noop,
  onSaveMecenat: noop,
  onSaveOvertime: noop,
  onSaveSolidarityHours: noop,
  onChangeRecoveryRangeKind: noop,
  onCloseRecoveryRange: noop,
  onStartRecoveryRangeSelection: noop,
  onSelectRecoveryInCalendar: noop,
  onSaveRecoveryUse: noop,
  onConfirmTime: noop,
  onConfirmNonWorkingDay: noop,
  onDeletePeriod: noop,
  onCheckForUpdate: noop,
  onExportData: noop,
  onImportData: noop,
  onArchiveLegacyData: noop,
  onDeleteAllData: noop,
};

describe("AppDialogLayer", () => {
  it("ne rend aucun dialogue lorsque tous les états sont fermés", () => {
    const html = renderToStaticMarkup(<AppDialogLayer {...baseProps} />);
    expect(html).toBe("");
  });

  it("compose les alertes planning et les notifications globales", () => {
    const html = renderToStaticMarkup(
      <AppDialogLayer
        {...baseProps}
        planning={{ ...baseProps.planning, warningDate: "2026-09-10" }}
        toast={{ ...baseProps.toast, message: "Une erreur contrôlée" }}
      />,
    );
    expect(html).toContain("Journée non travaillée");
    expect(html).toContain("groupe 2");
    expect(html).toContain("Impossible de continuer");
    expect(html).toContain("Une erreur contrôlée");
  });
});
