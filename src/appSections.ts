import { lazy } from "react";

// Le CET et la programmation GP ne servent qu'à l'ouverture de leur rubrique :
// chargés à part, ils sont préparés au repos (src/warmUpScreens.ts).
export const CetSection = lazy(() =>
  import("./CetSection").then(({ CetSection: Component }) => ({ default: Component })),
);
export const ColleaguePlanningPage = lazy(() =>
  import("./ColleaguePlanningPage").then(({ ColleaguePlanningPage: Component }) => ({ default: Component })),
);
export const ColleagueRequestNotice = lazy(() =>
  import("./ColleagueRequestNotice").then(({ ColleagueRequestNotice: Component }) => ({ default: Component })),
);
export const GrandPalaisProgramSection = lazy(() =>
  import("./GrandPalaisProgramSection").then(({ GrandPalaisProgramSection: Component }) => ({ default: Component })),
);
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
// Le contrôle du bulletin ne s'affiche que dans Ma paie : il se charge avec
// elle, hors du démarrage, et il est prêt dès que la page s'ouvre.
const payslipCheckModule = () => import("./PayslipCheckSection");
export const PayPage = lazy(() => {
  // Le contrôle du bulletin est préchargé avec la page, mais ne la retarde
  // pas : il a sa propre attente, à l'endroit où il s'affiche.
  void payslipCheckModule();
  return import("./PayPage").then(({ PayPage: Component }) => ({ default: Component }));
});
export const PayslipCheckSection = lazy(() =>
  payslipCheckModule().then(({ PayslipCheckSection: Component }) => ({ default: Component })),
);
export { PdfDownloadPage } from "./PdfDownloadPage";
export const UsefulContactsSection = lazy(() =>
  import("./UsefulContactsSection").then(({ UsefulContactsSection: Component }) => ({ default: Component })),
);
export const UsefulFormsSection = lazy(() =>
  import("./UsefulFormsSection").then(({ UsefulFormsSection: Component }) => ({ default: Component })),
);
