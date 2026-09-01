import { lazy } from "react";

export { CetSection } from "./CetSection";
export { GrandPalaisProgramSection } from "./GrandPalaisProgramSection";
export { LeaveBalancesSection } from "./LeaveBalancesSection";
export { LeaveManagementPage } from "./LeaveManagementPage";
export { PayAllowancesSection } from "./PayAllowancesSection";
export const PayEstimateDetails = lazy(() =>
  import("./PayEstimateDetails").then(({ PayEstimateDetails: Component }) => ({ default: Component })),
);
export const PayPage = lazy(() =>
  import("./PayPage").then(({ PayPage: Component }) => ({ default: Component })),
);
export { PayslipCheckSection } from "./PayslipCheckSection";
export { PdfDownloadPage } from "./PdfDownloadPage";
export { UsefulContactsSection } from "./UsefulContactsSection";
export { UsefulFormsSection } from "./UsefulFormsSection";
export { UserGuideDialogs } from "./UserGuideDialogs";
