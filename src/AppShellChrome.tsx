import { type Dispatch, lazy, type SetStateAction, Suspense, useState } from "react";
import { AdaptiveNavigation, AppHeader } from "./AppNavigation";
import { AppleInstallNotice } from "./AppleInstallNotice";
import { clearColleagueGroupsCache } from "./colleagueSharingApi";
import { HomeAdminMessage } from "./HomeAdminMessage";
import { InstallAppNotice } from "./InstallAppNotice";
import type { HelpChoice } from "./HelpSheet";
import { type HelpTarget, requestHelpTarget } from "./helpTargets";
import { computePayAllowances } from "./payAllowances";
import { dateKey, localDate } from "./planningLogic";
import { scrollWhenReady } from "./scrollWhenReady";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { useAuthenticationActions } from "./useAuthenticationActions";
import type { useCalendarDataState } from "./useCalendarDataState";
import type { useFeedbackMessaging } from "./useFeedbackMessaging";
import type { useInstallPrompt } from "./useInstallPrompt";
import type { usePayProfileValues } from "./usePayProfileValues";
import type { usePayUiState } from "./usePayUiState";
import type { useSectionNavigation } from "./useSectionNavigation";
import type { useShellEffects } from "./useShellEffects";
import type { useToast } from "./useToast";

const HelpSheet = lazy(() => import("./HelpSheet"));
const AdminToolsPanel = lazy(() => import('./AdminToolsPanel').then(module => ({ default: module.AdminToolsPanel })));

type Props = {
  now: Date;
  group: number;
  demoMode: boolean;
  userEmail: string;
  isProgramAdmin: boolean;
  /** Administrateur réellement connecté, aperçu invité compris. */
  actualProgramAdmin: boolean;
  /** Tant que le rôle n'est pas connu, rien de réservé aux invités ne s'affiche. */
  programAdminKnown: boolean;
  admin: {
    guestPreview: boolean;
    setGuestPreview: Dispatch<SetStateAction<boolean>>;
    adminToolsOpen: boolean;
    setAdminToolsOpen: Dispatch<SetStateAction<boolean>>;
    setAdminRevision: Dispatch<SetStateAction<number>>;
  };
  installation: ReturnType<typeof useInstallPrompt> & { enabled: boolean };
  shell: Pick<
    ReturnType<typeof useAppShellUiState>,
    | "homeSection" | "setHomeSection" | "accountMenuOpen" | "setAccountMenuOpen"
    | "checkingAppUpdate" | "appUpdateAvailable" | "appUpdatePromptOpen" | "accountMenuRef" | "accountButtonRef"
    | "setDataManagementOpen" | "setFeedbackOpen"
  >;
  pay: Pick<ReturnType<typeof usePayUiState>, "payScreen" | "setPayScreen" | "setPayView" | "setPayVerificationRequested">;
  calendar: Pick<ReturnType<typeof useCalendarDataState>, "entries" | "periods" | "formProfile" | "recoveryUses">;
  /** Ce que le rappel des fériés recalcule pour une année : salaire de base
   *  et reports de dimanches. */
  allowanceValues: Pick<
    ReturnType<typeof usePayProfileValues>,
    "baseSalary" | "sundayCarryover" | "sundayCarryoverYear" | "sundayCarryoverMonth" | "sundayCarryoverFromYear" | "sundayCarryoverFromMonth"
  >;
  feedbackMessaging: Pick<ReturnType<typeof useFeedbackMessaging>, "unreadCount">;
  notify: ReturnType<typeof useToast>["notify"];
  showSuccess: ReturnType<typeof useToast>["confirm"];
  /** Ce que la fenêtre d'aide ouvre hors des pages : les plannings PDF de
   *  l'accueil et le formulaire de demande vierge. */
  help: { openPlanningPdf: () => void; openBlankForm: () => void; requestLeave: () => void; openExchange: () => void };
  actions: Pick<ReturnType<typeof useSectionNavigation>, "navigateFromShell">
    & Pick<ReturnType<typeof useShellEffects>, "checkForAppUpdate">
    & Pick<ReturnType<typeof useAuthenticationActions>, "disconnect">;
};

/**
 * La coque de l'application : en-tête et menu du compte, navigation,
 * propositions d'installation, aperçu invité et outils de
 * l'administrateur, rappel des jours fériés. Les états et les actions restent
 * dans App.tsx ; ce composant les relie aux éléments communs à tous les écrans.
 */
export function AppShellChrome({
  now, group, demoMode, userEmail, isProgramAdmin, actualProgramAdmin, programAdminKnown,
  admin, installation, shell, pay, calendar, allowanceValues, feedbackMessaging, notify, showSuccess, help, actions,
}: Props) {
  const { guestPreview, setGuestPreview, adminToolsOpen, setAdminToolsOpen, setAdminRevision } = admin;
  const { enabled: installationEnabled, installPrompt, installApp } = installation;
  const {
    homeSection, setHomeSection, accountMenuOpen, setAccountMenuOpen,
    checkingAppUpdate, appUpdateAvailable, appUpdatePromptOpen, accountMenuRef, accountButtonRef,
    setDataManagementOpen, setFeedbackOpen,
  } = shell;
  const { payScreen, setPayScreen, setPayView } = pay;
  const { entries, periods, formProfile, recoveryUses } = calendar;
  const {
    baseSalary, sundayCarryover, sundayCarryoverYear, sundayCarryoverMonth, sundayCarryoverFromYear, sundayCarryoverFromMonth,
  } = allowanceValues;
  const { navigateFromShell, checkForAppUpdate, disconnect } = actions;
  const [helpOpen, setHelpOpen] = useState(false);
  // Chaque question de la fenêtre d'aide : la page, puis l'onglet ou la
  // sous-page que l'écran visé ouvre de lui-même (helpTargets).
  const chooseHelp = (choice: HelpChoice) => {
    setHelpOpen(false);
    const open = (section: Parameters<typeof navigateFromShell>[0], target?: HelpTarget) => {
      navigateFromShell(section);
      window.scrollTo({ top: 0, behavior: "auto" });
      if (target) requestHelpTarget(target);
    };
    const openPay = (screen: "allowances" | "payslip" | "overview") => {
      open("pay");
      setPayScreen(screen);
    };
    switch (choice) {
      case "phone": return open("pdf", "contacts");
      case "radio": return open("pdf", "radio-codes");
      case "form": return open("pdf", "forms");
      case "work-accident": return open("pdf", "work-accident");
      case "expo-dates": return open("program", "program-space");
      case "expo-folder": return open("pdf", "expo-folder");
      case "interexpo": return open("program", "program-interexpo");
      case "allowances": return openPay("allowances");
      case "pay-detail": return openPay("payslip");
      case "payslip-check":
        openPay("overview");
        pay.setPayVerificationRequested(true);
        return;
      case "overtime-mecenat": return open("leave", "overtime-mecenat");
      case "cet": return open("leave", "cet");
      case "planning-pdf":
        open("home");
        help.openPlanningPdf();
        return;
      case "request-form": return help.openBlankForm();
      case "share-planning": return open("colleagues", "colleague-share");
      case "colleague-groups": return open("colleagues", "colleague-groups");
      case "request-leave":
        open("home");
        help.requestLeave();
        return;
      case "exchange":
        open("home");
        help.openExchange();
        return;
      default: {
        // Une question ajoutée à la fenêtre d'aide sans chemin ici ne compile pas.
        const unhandled: never = choice;
        return unhandled;
      }
    }
  };
  return (
    <>
      <AppHeader
        onOpenAdminTools={isProgramAdmin ? () => { setAccountMenuOpen(false); setAdminToolsOpen(true); } : undefined}
        homeSection={homeSection}
        payScreen={payScreen}
        userEmail={userEmail}
        fullName={formProfile?.fullName || ""}
        accountMenuOpen={accountMenuOpen}
        checkingAppUpdate={checkingAppUpdate}
        appUpdateAvailable={appUpdateAvailable}
        updateCallVisible={appUpdateAvailable && !appUpdatePromptOpen}
        demoMode={demoMode}
        unreadFeedbackCount={isProgramAdmin ? feedbackMessaging.unreadCount : 0}
        notify={notify}
        showSuccess={showSuccess}
        accountMenuRef={accountMenuRef}
        accountButtonRef={accountButtonRef}
        onToggleAccount={() => setAccountMenuOpen((current) => !current)}
        onDisconnect={() => {
          setAccountMenuOpen(false);
          void disconnect();
        }}
        onCheckForUpdate={() => void checkForAppUpdate()}
        onOpenDataManagement={() => {
          setAccountMenuOpen(false);
          setDataManagementOpen(true);
        }}
        install={demoMode || installPrompt ? {
          available: Boolean(installationEnabled && installPrompt),
          onInstall: () => {
            setAccountMenuOpen(false);
            void installApp();
          },
        } : undefined}
        onOpenFeedback={isProgramAdmin ? () => {
          setAccountMenuOpen(false);
          setFeedbackOpen(true);
        } : undefined}
        onOpenHelp={() => {
          setAccountMenuOpen(false);
          setHelpOpen(true);
        }}
      />
      {helpOpen ? (
        <Suspense fallback={null}>
          <HelpSheet today={dateKey(now)} section={homeSection} onChoose={chooseHelp} onClose={() => setHelpOpen(false)} />
        </Suspense>
      ) : null}
      <AdaptiveNavigation
        homeSection={homeSection}
        onNavigate={(section) => navigateFromShell(section)}
      />
      {/* Placé après la navigation : la marche à suivre s'affiche quelle que
          soit la rubrique ouverte au lancement. */}
      <AppleInstallNotice enabled={installationEnabled} />
      {/* Les invités dont le navigateur sait installer l'application, et qui
          ne l'ont pas encore fait, se la voient proposer d'un geste. */}
      <InstallAppNotice
        available={Boolean(installationEnabled && installPrompt && programAdminKnown && !isProgramAdmin)}
        onInstall={() => void installApp()}
      />
      {actualProgramAdmin && guestPreview && <div className="admin-preview-banner" role="status">Aperçu invité · Vos données<button type="button" onClick={() => setGuestPreview(false)}>Quitter l’aperçu</button></div>}
      {isProgramAdmin && adminToolsOpen && <Suspense fallback={<p role="status">Ouverture des outils…</p>}><AdminToolsPanel demoMode={demoMode} onClose={() => setAdminToolsOpen(false)} onPreview={() => { setAdminToolsOpen(false); setGuestPreview(true); }} onChanged={() => { clearColleagueGroupsCache(); setAdminRevision(value => value + 1); }} /></Suspense>}
      {homeSection === 'home' && <HomeAdminMessage
        demoMode={demoMode}
        hideHolidayReminder={isProgramAdmin}
        holidayChoicesPending={(year) => {
          // Les fériés de l'année du rappel encore sans prime ni récup choisie.
          const yearAllowances = computePayAllowances({
            year, today: now, entries, periods, group, baseSalary,
            manualAdjustments: formProfile?.manualAdjustments,
            sundayCarryover, sundayCarryoverYear, sundayCarryoverMonth,
            sundayCarryoverFromYear, sundayCarryoverFromMonth, recoveryUses,
          });
          return { worked: yearAllowances.holidayPending, compensated: yearAllowances.compensated.filter((item) => !item.choice).length };
        }}
        onOpenHolidayChoices={(year) => {
          setHomeSection("pay");
          setPayView(localDate(year, 0, 1));
          setPayScreen("allowances");
          scrollWhenReady("holiday-choices");
        }}
      />}
    </>
  );
}
