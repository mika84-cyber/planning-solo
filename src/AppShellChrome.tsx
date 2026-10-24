import { type Dispatch, lazy, type SetStateAction, Suspense } from "react";
import { AdaptiveNavigation, AppHeader, MainMenu } from "./AppNavigation";
import { AppleInstallNotice } from "./AppleInstallNotice";
import { clearColleagueGroupsCache } from "./colleagueSharingApi";
import { HomeAdminMessage } from "./HomeAdminMessage";
import { InstallAppNotice } from "./InstallAppNotice";
import { computePayAllowances } from "./payAllowances";
import { localDate } from "./planningLogic";
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
    | "homeSection" | "setHomeSection" | "accountMenuOpen" | "setAccountMenuOpen" | "mainMenuOpen" | "setMainMenuOpen"
    | "checkingAppUpdate" | "appUpdateAvailable" | "appUpdatePromptOpen" | "accountMenuRef" | "accountButtonRef"
    | "setDataManagementOpen" | "setFeedbackOpen"
  >;
  pay: Pick<ReturnType<typeof usePayUiState>, "payScreen" | "setPayScreen" | "setPayView">;
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
  actions: Pick<ReturnType<typeof useSectionNavigation>, "navigateFromShell">
    & Pick<ReturnType<typeof useShellEffects>, "checkForAppUpdate">
    & Pick<ReturnType<typeof useAuthenticationActions>, "disconnect">;
};

/**
 * La coque de l'application : en-tête, navigation, propositions
 * d'installation, menu principal, aperçu invité et outils de
 * l'administrateur, rappel des jours fériés. Les états et les actions restent
 * dans App.tsx ; ce composant les relie aux éléments communs à tous les écrans.
 */
export function AppShellChrome({
  now, group, demoMode, userEmail, isProgramAdmin, actualProgramAdmin, programAdminKnown,
  admin, installation, shell, pay, calendar, allowanceValues, feedbackMessaging, notify, showSuccess, actions,
}: Props) {
  const { guestPreview, setGuestPreview, adminToolsOpen, setAdminToolsOpen, setAdminRevision } = admin;
  const { enabled: installationEnabled, installPrompt, installApp } = installation;
  const {
    homeSection, setHomeSection, accountMenuOpen, setAccountMenuOpen, mainMenuOpen, setMainMenuOpen,
    checkingAppUpdate, appUpdateAvailable, appUpdatePromptOpen, accountMenuRef, accountButtonRef,
    setDataManagementOpen, setFeedbackOpen,
  } = shell;
  const { payScreen, setPayScreen, setPayView } = pay;
  const { entries, periods, formProfile, recoveryUses } = calendar;
  const {
    baseSalary, sundayCarryover, sundayCarryoverYear, sundayCarryoverMonth, sundayCarryoverFromYear, sundayCarryoverFromMonth,
  } = allowanceValues;
  const { navigateFromShell, checkForAppUpdate, disconnect } = actions;
  return (
    <>
      <AppHeader
        onOpenAdminTools={isProgramAdmin ? () => { setAccountMenuOpen(false); setAdminToolsOpen(true); } : undefined}
        homeSection={homeSection}
        payScreen={payScreen}
        userEmail={userEmail}
        fullName={formProfile?.fullName || ""}
        accountMenuOpen={accountMenuOpen}
        mainMenuOpen={mainMenuOpen}
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
        onOpenMainMenu={() => {
          history.pushState({ ...(history.state || {}), planningSection: homeSection, planningOverlay: "menu" }, "", location.href);
          setMainMenuOpen(true);
        }}
        onCheckForUpdate={() => void checkForAppUpdate()}
      />
      <AdaptiveNavigation
        homeSection={homeSection}
        onNavigate={(section) => navigateFromShell(section)}
        onMore={() => {
          history.pushState({ ...(history.state || {}), planningSection: homeSection, planningOverlay: "menu" }, "", location.href);
          setMainMenuOpen(true);
        }}
        unreadFeedbackCount={isProgramAdmin ? feedbackMessaging.unreadCount : 0}
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
      <MainMenu
        open={mainMenuOpen}
        onClose={() => setMainMenuOpen(false)}
        onNavigate={(section) => navigateFromShell(section)}
        currentSection={homeSection}
        showInstallAction={demoMode || Boolean(installPrompt)}
        canInstall={Boolean(installationEnabled && installPrompt)}
        onInstall={() => void installApp()}
        onOpenDataManagement={() => {
          setMainMenuOpen(false);
          setDataManagementOpen(true);
        }}
        onOpenFeedback={() => {
          setMainMenuOpen(false);
          setFeedbackOpen(true);
        }}
        isAdmin={isProgramAdmin}
        unreadFeedbackCount={isProgramAdmin ? feedbackMessaging.unreadCount : 0}
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
