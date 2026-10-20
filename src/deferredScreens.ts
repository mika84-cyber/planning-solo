/** Écrans et fenêtres qui n'ont pas leur place dans le chargement initial :
 *  la page Congés et ses soldes, les primes de la paie, les plannings PDF, les
 *  étapes d'une demande et les fenêtres des heures, des congés et des données.
 *
 *  Ils sont réunis dans un seul module, donc un seul morceau livré :
 *  compressés ensemble, ils pèsent nettement moins que neuf petits fichiers,
 *  et ils sont de toute façon préparés dès que l'application est au repos
 *  (warmUpScreens). Les composants s'importent par `lazy()` depuis ici. */
export { DataManagementDialog } from "./DataManagementDialog";
export { LeaveBalancesSection } from "./LeaveBalancesSection";
export { ManualAdjustmentsDialog, RangeLeaveDialog } from "./LeaveDialogs";
export { LeaveManagementPage } from "./LeaveManagementPage";
export { PayAllowancesSection } from "./PayAllowancesSection";
export { PdfDownloadPage } from "./PdfDownloadPage";
export { RequestSelectionPanel } from "./RequestSelectionPanel";
export {
  MecenatDialog,
  OvertimeDialog,
  RecoveryRangeDialog,
  RecoveryUseDialog,
  SolidarityHoursDialog,
} from "./WorkTimeDialogs";
