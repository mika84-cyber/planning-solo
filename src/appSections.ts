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
// Le contrôle du bulletin ne s'affiche que dans Ma paie : il se charge avec
// elle, hors du démarrage, et il est prêt dès que la page s'ouvre.
const payslipCheckModule = () => import("./PayslipCheckSection");
export const PayPage = lazy(() => {
  // Les deux téléchargements partent ensemble ; la page attend le contrôle.
  const payslipCheck = payslipCheckModule();
  return import("./PayPage").then(async ({ PayPage: Component }) => {
    await payslipCheck;
    return { default: Component };
  });
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
