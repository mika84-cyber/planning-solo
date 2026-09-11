import { lazy } from "react";

export { CetSection } from "./CetSection";
export const ColleaguePlanningPage = lazy(() =>
  import("./ColleaguePlanningPage").then(({ ColleaguePlanningPage: Component }) => ({ default: Component })),
);
export const ColleagueRequestNotice = lazy(() =>
  import("./ColleagueRequestNotice").then(({ ColleagueRequestNotice: Component }) => ({ default: Component })),
);
export { GrandPalaisProgramSection } from "./GrandPalaisProgramSection";
export const FeedbackMessenger = lazy(() =>
  import("./FeedbackMessenger").then(({ FeedbackMessenger: Component }) => ({ default: Component })),
);
export const FeedbackResolutionAlert = lazy(() =>
  import("./FeedbackMessenger").then(({ FeedbackResolutionAlert: Component }) => ({ default: Component })),
);
export const DocumentAnnouncementNotice = lazy(() =>
  import("./DocumentAnnouncementNotice").then(({ DocumentAnnouncementNotice: Component }) => ({ default: Component })),
);
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
export const UsefulContactsSection = lazy(() =>
  import("./UsefulContactsSection").then(({ UsefulContactsSection: Component }) => ({ default: Component })),
);
export const UsefulFormsSection = lazy(() =>
  import("./UsefulFormsSection").then(({ UsefulFormsSection: Component }) => ({ default: Component })),
);
