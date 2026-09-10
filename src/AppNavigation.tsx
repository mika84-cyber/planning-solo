import { lazy, Suspense, type RefObject } from "react";

const NoteReminderButton = lazy(() => import("./NoteReminderButton"));

export const MAIN_SECTION_ORDER = [
  "home",
  "leave",
  "pay",
  "pdf",
  "program",
  "colleagues",
] as const;

export type MainSection = (typeof MAIN_SECTION_ORDER)[number] | "forms";
export type PayScreen = "overview" | "allowances" | "payslip";

function NavigationIcon({ section }: { section: MainSection | "more" | "feedback" | "update" | "data" | "install" }) {
  const paths: Record<string, string> = {
    home: "M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z", leave: "M7 3v3m10-3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2z",
    pay: "M4 7h16v12H4zM7 4h10v3M7 12h5m-5 4h9", pdf: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6m-6 4h6",
    forms: "M4 5h7l2 2h7v12H4z", program: "M4 20V8l8-5 8 5v12M8 20v-7h8v7", colleagues: "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8-1a3 3 0 1 0 0-6m-14 16c0-4 3-7 6-7s6 3 6 7m1-7c3 0 6 3 6 7",
    more: "M12 5v14M5 12h14", feedback: "M4 5h16v12H8l-4 4z", update: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7", data: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5", install: "M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[section]} /></svg>;
}

export function AdaptiveNavigation({ homeSection, onNavigate }: {
  homeSection: MainSection; onNavigate: (section: MainSection) => void; onMore: () => void; unreadFeedbackCount: number;
}) {
  const mobilePrimary = MAIN_SECTION_ORDER.map((key) => ({
    key,
    label: key === "home" ? "Accueil" : key === "leave" ? "Congés" : key === "pay" ? "Ma paie" : key === "pdf" ? "Docs" : key === "program" ? "Expos" : "Collègues",
  }));
  const desktopPrimary = MAIN_SECTION_ORDER.map((key) => ({ key, label: key === "home" ? "Accueil" : key === "leave" ? "Congés" : key === "pay" ? "Ma paie" : key === "pdf" ? "Documents" : key === "program" ? "Programme" : "Collègues" }));
  const isActive = (key: MainSection) => homeSection === key || (key === "pdf" && homeSection === "forms");
  return <>
    <nav className="mobile-bottom-navigation" aria-label="Navigation principale">
      {mobilePrimary.map(({ key, label }) => <button key={key} type="button" className={isActive(key) ? "active" : ""} aria-current={isActive(key) ? "page" : undefined} onClick={() => onNavigate(key)}><NavigationIcon section={key} /><span>{label}</span></button>)}
    </nav>
    <nav className="desktop-side-navigation" aria-label="Navigation principale">
      {desktopPrimary.map(({ key, label }) => <button key={key} type="button" className={isActive(key) ? "active" : ""} aria-current={isActive(key) ? "page" : undefined} onClick={() => onNavigate(key)} title={label}><NavigationIcon section={key} /><span>{label}</span></button>)}
    </nav>
  </>;
}

function headerTitle(section: MainSection, payScreen: PayScreen) {
  if (section === "home") return "Accueil";
  if (section === "leave") return "Congés et récupérations";
  if (section === "pdf" || section === "forms") return "Documents et contacts";
  if (section === "program") return "Programmation GP";
  if (section === "colleagues") return "Planning des collègues";
  if (payScreen === "allowances") return "Primes et jours fériés";
  if (payScreen === "payslip") return "Détail du calcul";
  return "Ma paie";
}

function headerClass(section: MainSection) {
  if (section === "pdf") return "top-header top-header-pdf top-header-forms";
  return section === "home"
    ? "top-header top-header-home"
    : `top-header top-header-${section}`;
}

type AppHeaderProps = {
  homeSection: MainSection;
  payScreen: PayScreen;
  userEmail: string;
  fullName: string;
  accountMenuOpen: boolean;
  mainMenuOpen: boolean;
  checkingAppUpdate: boolean;
  appUpdateAvailable: boolean;
  demoMode: boolean;
  unreadFeedbackCount: number;
  notify: (text: string) => void;
  accountMenuRef: RefObject<HTMLDivElement | null>;
  accountButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleAccount: () => void;
  onDisconnect: () => void;
  onOpenMainMenu: () => void;
  onCheckForUpdate: () => void;
  onOpenAdminTools?: () => void;
};

export function AppHeader({
  homeSection,
  payScreen,
  userEmail,
  fullName,
  accountMenuOpen,
  mainMenuOpen,
  checkingAppUpdate,
  appUpdateAvailable,
  demoMode,
  unreadFeedbackCount,
  notify,
  accountMenuRef,
  accountButtonRef,
  onToggleAccount,
  onDisconnect,
  onOpenMainMenu,
  onCheckForUpdate,
  onOpenAdminTools,
}: AppHeaderProps) {
  const updateLabel = checkingAppUpdate
    ? "Chargement de la mise à jour…"
    : appUpdateAvailable
      ? "Vous avez une mise à jour"
      : "Vérifier les mises à jour";
  return (
    <header className={headerClass(homeSection)} data-section={homeSection} data-pay-screen={homeSection === "pay" ? payScreen : undefined}>
      <div className="top-header-title header-section-title">
        <p className="eyebrow">Planning Solo</p>
        <h1>
          {homeSection === "colleagues" ? (
            <><span>Planning des</span>{" "}<span>collègues</span></>
          ) : homeSection === "forms" ? (
            <><span className="header-title-line">Contacts et</span>{" "}<span className="header-title-line">formulaires</span></>
          ) : homeSection === "pdf" ? (
            <><span className="header-title-line">Documents et</span>{" "}<span className="header-title-line">contacts</span></>
          ) : headerTitle(homeSection, payScreen)}
        </h1>
      </div>
      {homeSection === "colleagues" ? (
        <img
          className="colleague-header-illustration"
          src="/colleague-planning-header.png"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      ) : null}
      <div className="header-command-area">
        <div className="header-control-cluster">
          <div className="header-actions">
            <Suspense fallback={null}>
              <NoteReminderButton demoMode={demoMode} notify={notify} />
            </Suspense>
            <div className="account-menu" ref={accountMenuRef}>
              <button
                className={`account-button${accountMenuOpen ? " open" : ""}${appUpdateAvailable ? " update-available" : ""}`}
                type="button"
                ref={accountButtonRef}
                onClick={onToggleAccount}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label={appUpdateAvailable ? "Compte — mise à jour disponible" : "Compte"}
              >
                {(userEmail[0] || "M").toUpperCase()}
                {appUpdateAvailable ? <em className="main-menu-feedback-badge account-update-dot" role="status" aria-label="Mise à jour à effectuer">!</em> : null}
              </button>
              {accountMenuOpen ? (
                <div className="account-menu-panel" role="menu">
                  <div className="account-menu-identity">
                    <strong>{fullName || "Mon compte"}</strong>
                    <small>{userEmail}</small>
                  </div>
                  {appUpdateAvailable ? (
                    <div className="account-update-alert" role="status">
                      <strong>Une mise à jour est disponible</strong>
                      <span>Ouvrez le menu principal pour l’installer.</span>
                    </div>
                  ) : null}
                  {onOpenAdminTools && <button className="account-menu-data" type="button" role="menuitem" onClick={onOpenAdminTools}>Outils administrateur</button>}
                  <button className="account-menu-leave" type="button" role="menuitem" onClick={onDisconnect}>
                    Se déconnecter
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <button
            className="main-menu-button"
            type="button"
            onClick={onOpenMainMenu}
            aria-label="Ouvrir le menu principal"
            aria-expanded={mainMenuOpen}
            aria-controls="main-menu-drawer"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            {unreadFeedbackCount > 0 ? <em className="main-menu-feedback-badge" role="status" aria-label={`${unreadFeedbackCount} message${unreadFeedbackCount > 1 ? "s" : ""} non lu${unreadFeedbackCount > 1 ? "s" : ""}`}>{unreadFeedbackCount > 9 ? "9+" : unreadFeedbackCount}</em> : null}
          </button>
        </div>
        {appUpdateAvailable ? <button
          className={`app-update-button header-update-button${checkingAppUpdate ? " checking" : ""}${appUpdateAvailable ? " update-available" : ""}`}
          type="button"
          onClick={onCheckForUpdate}
          disabled={checkingAppUpdate}
          aria-label={updateLabel}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 4v7h-7" />
          </svg>
          <span className="header-update-label">{updateLabel}</span>
          <span className="header-update-label-compact" aria-hidden="true">Installer</span>
        </button> : null}
      </div>
    </header>
  );
}

type MainMenuProps = {
  open: boolean;
  userEmail: string;
  fullName: string;
  checkingAppUpdate: boolean;
  appUpdateAvailable: boolean;
  online: boolean;
  syncStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string;
  showInstallAction: boolean;
  canInstall: boolean;
  onClose: () => void;
  onCheckForUpdate: () => void;
  onOpenDataManagement: () => void;
  onInstall: () => void;
  onOpenFeedback: (view: "compose" | "inbox") => void;
  isAdmin: boolean;
  unreadFeedbackCount: number;
};

export function MainMenu({ open, userEmail, fullName, checkingAppUpdate, appUpdateAvailable, online, syncStatus, lastSavedAt, showInstallAction, canInstall, onClose, onCheckForUpdate, onOpenDataManagement, onInstall, onOpenFeedback, isAdmin, unreadFeedbackCount }: MainMenuProps) {
  if (!open) return null;
  const savedTime = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const saveState = !online
    ? { tone: "offline", text: "Hors connexion : les changements attendent la connexion" }
    : syncStatus === "saving"
      ? { tone: "saving", text: "Enregistrement en cours…" }
      : syncStatus === "error"
        ? { tone: "error", text: "La dernière sauvegarde a échoué" }
        : syncStatus === "saved"
          ? { tone: "saved", text: `Dernière sauvegarde à ${savedTime}` }
          : { tone: "saved", text: "Sauvegarde automatique active" };
  return (
    <div
      className="main-menu-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="main-menu-drawer" id="main-menu-drawer" aria-label="Menu principal">
        <header>
          <div><span className="step-label">Planning Solo</span><h2>Compte et réglages</h2></div>
          <button type="button" onClick={onClose} aria-label="Fermer le menu">×</button>
        </header>
        <div className="main-menu-account-card">
          <span aria-hidden="true">{(userEmail[0] || "M").toUpperCase()}</span>
          <div><strong>{fullName || "Mon compte"}</strong><small>{userEmail}</small></div>
        </div>
        <div className={`main-menu-save-status ${saveState.tone}`} role="status" aria-live="polite">
          <span aria-hidden="true">{saveState.tone === "saved" ? "✓" : "!"}</span>
          <div><strong>État de sauvegarde</strong><small>{saveState.text}</small></div>
        </div>
        <nav aria-label="Compte et réglages">
          <button type="button" onClick={onCheckForUpdate} disabled={checkingAppUpdate}>
            <span className="main-menu-index" aria-hidden="true"><NavigationIcon section="update" /></span>
            <span className="main-menu-copy"><strong>{checkingAppUpdate ? "Recherche en cours…" : appUpdateAvailable ? "Installer la mise à jour" : "Vérifier les mises à jour"}</strong><small>{appUpdateAvailable ? "Une nouvelle version est prête" : "Garder l’application à jour"}</small></span>
            <span className="main-menu-chevron" aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={onOpenDataManagement}>
            <span className="main-menu-index" aria-hidden="true"><NavigationIcon section="data" /></span>
            <span className="main-menu-copy"><strong>Mes données</strong><small>Sauvegarder, reprendre ou effacer mes informations</small></span>
            <span className="main-menu-chevron" aria-hidden="true">›</span>
          </button>
          {showInstallAction ? <button type="button" onClick={onInstall} disabled={!canInstall}>
            <span className="main-menu-index" aria-hidden="true"><NavigationIcon section="install" /></span>
            <span className="main-menu-copy"><strong>Installer l’application</strong><small>{canInstall ? "L’ajouter à l’écran d’accueil" : "Disponible après connexion"}</small></span>
            <span className="main-menu-chevron" aria-hidden="true">›</span>
          </button> : null}
        </nav>
        <div className="main-menu-secondary">
          <button type="button" className="guide-menu-entry feedback-menu-entry" onClick={() => onOpenFeedback(isAdmin ? "inbox" : "compose")}>
            <span className="main-menu-index" aria-hidden="true"><NavigationIcon section="feedback" /></span>
            <span className="main-menu-copy"><strong>{isAdmin ? "Messagerie interne" : "Écrire à l’administrateur"}</strong><small>{isAdmin ? `${unreadFeedbackCount} message${unreadFeedbackCount > 1 ? "s" : ""} non lu${unreadFeedbackCount > 1 ? "s" : ""}` : "Une idée, une suggestion ou un bug"}</small></span>
            <span className="main-menu-chevron" aria-hidden="true">›</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
