import { lazy, Suspense, type RefObject } from "react";
import { ThemeSwitch } from "./ThemePreferenceControl";

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
export type PayScreen = "overview" | "allowances" | "payslip" | "year";

/** Les icônes des rubriques, reprises aussi par « Que cherchez-vous ? ». */
export const NAVIGATION_ICON_PATHS: Record<string, string> = {
  // Chaque rubrique a une image qui se comprend seule : une maison, un
  // coucher de soleil sur la mer pour les congés, une pièce en euros pour la
  // paie, une feuille écrite, un musée à colonnes, deux personnes.
  home: "M3 10.5 12 3l9 7.5M5.5 8.8V21h4.5v-6h4v6h4.5V8.8",
  leave: "M12 3.5v1.5M5.6 6.6l1.1 1.1M18.4 6.6l-1.1 1.1M3 13h2m14 0h2M8 13a4 4 0 0 1 8 0M3 17.5c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1",
  pay: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15.5 8.8a4 4 0 1 0 0 6.4M7.5 10.8h6M7.5 13.2h6",
  pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 12.5h6M9 16.5h6",
  program: "M2.5 9.5 12 3.5l9.5 6M4 9.5h16M5.5 12v6.5m4.33-6.5v6.5m4.34-6.5v6.5m4.33-6.5v6.5M3 21h18",
  colleagues: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2.5 21v-.5a6.5 6.5 0 0 1 13 0v.5M16 3.2a4 4 0 0 1 0 7.6M21.5 21v-.5a6.5 6.5 0 0 0-4-6",
};

function NavigationIcon({ section }: { section: (typeof MAIN_SECTION_ORDER)[number] }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={NAVIGATION_ICON_PATHS[section]} /></svg>;
}

/** Les six rubriques : un nom court pour le dock, un nom complet pour les
 *  lecteurs d'écran. */
const SECTION_TABS = MAIN_SECTION_ORDER.map((key) => ({
  key,
  short: key === "home" ? "Accueil" : key === "leave" ? "Congés" : key === "pay" ? "Ma paie" : key === "pdf" ? "Docs" : key === "program" ? "Expos" : "Collègues",
  long: key === "home" ? "Accueil" : key === "leave" ? "Congés" : key === "pay" ? "Ma paie" : key === "pdf" ? "Documents" : key === "program" ? "Programme" : "Collègues",
}));

/** Le dock : une capsule sombre posée en bas de l'écran. Chaque rubrique
 *  montre son icône et son nom ; la rubrique ouverte passe en pastille
 *  claire. Sur petit écran, « Collègues » devient « Team ». */
export function AdaptiveNavigation({ homeSection, onNavigate }: {
  homeSection: MainSection; onNavigate: (section: MainSection) => void;
}) {
  const isActive = (key: MainSection) => homeSection === key || (key === "pdf" && homeSection === "forms");
  return (
    <nav className="section-dock" aria-label="Navigation principale">
      {SECTION_TABS.map(({ key, short, long }) => (
        <button
          key={key}
          type="button"
          data-section={key}
          className={isActive(key) ? "active" : ""}
          aria-current={isActive(key) ? "page" : undefined}
          aria-label={long}
          onClick={() => onNavigate(key)}
        >
          <NavigationIcon section={key} />
          <span aria-hidden="true">{short}</span>
        </button>
      ))}
    </nav>
  );
}

function headerTitle(section: MainSection, payScreen: PayScreen) {
  if (section === "home") return "Accueil";
  if (section === "leave") return "Congés et récupérations";
  if (section === "pdf" || section === "forms") return "Documents et contacts";
  if (section === "program") return "Programme GP";
  if (section === "colleagues") return "Planning partagé";
  if (payScreen === "allowances") return "Primes et jours fériés";
  if (payScreen === "payslip") return "Détail du calcul";
  // « coup d’œil » reste ensemble : sur téléphone, « coup » ouvre la 2e ligne.
  if (payScreen === "year") return "L’année en un coup d’œil";
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
  checkingAppUpdate: boolean;
  appUpdateAvailable: boolean;
  /** Une mise à jour attend et sa fenêtre a été fermée sans la faire. */
  updateCallVisible?: boolean;
  demoMode: boolean;
  unreadFeedbackCount: number;
  notify: (text: string) => void;
  showSuccess?: (text: string) => void;
  accountMenuRef: RefObject<HTMLDivElement | null>;
  accountButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleAccount: () => void;
  onDisconnect: () => void;
  onCheckForUpdate: () => void;
  /** Les outils rangés dans le menu du compte. */
  onOpenDataManagement: () => void;
  /** « Installer l'application » : proposée quand le navigateur sait le faire. */
  install?: { available: boolean; onInstall: () => void };
  /** La messagerie interne, réservée à l'administrateur. */
  onOpenFeedback?: () => void;
  onOpenAdminTools?: () => void;
  /** « Que cherchez-vous ? » : ouvre la fenêtre des questions. */
  onOpenHelp?: () => void;
};

export function AppHeader({
  homeSection,
  payScreen,
  userEmail,
  fullName,
  accountMenuOpen,
  checkingAppUpdate,
  appUpdateAvailable,
  updateCallVisible = false,
  demoMode,
  unreadFeedbackCount,
  notify,
  showSuccess,
  accountMenuRef,
  accountButtonRef,
  onToggleAccount,
  onDisconnect,
  onCheckForUpdate,
  onOpenDataManagement,
  install,
  onOpenFeedback,
  onOpenAdminTools,
  onOpenHelp,
}: AppHeaderProps) {
  const updateLabel = checkingAppUpdate
    ? "Mise à jour en cours…"
    : appUpdateAvailable
      ? "Installer la mise à jour"
      : "Vérifier les mises à jour";
  const unreadLabel = `${unreadFeedbackCount} message${unreadFeedbackCount > 1 ? "s" : ""} non lu${unreadFeedbackCount > 1 ? "s" : ""}`;
  return (
    <header className={headerClass(homeSection)} data-section={homeSection} data-pay-screen={homeSection === "pay" ? payScreen : undefined}>
      <div className="top-header-title header-section-title">
        <p className="eyebrow">Planning Solo</p>
        <h1>
          {homeSection === "colleagues" ? (
            <><span>Planning</span>{" "}<span>partagé</span></>
          ) : homeSection === "program" ? (
            <><span>Programme</span>{" "}<span>GP</span></>
          ) : homeSection === "forms" ? (
            <><span className="header-title-line">Contacts et</span>{" "}<span className="header-title-line">formulaires</span></>
          ) : homeSection === "pdf" ? (
            <><span className="header-title-line">Documents et</span>{" "}<span className="header-title-line">contacts</span></>
          ) : headerTitle(homeSection, payScreen)}
        </h1>
      </div>
      {/* Mise à jour en attente : un bouton bien visible au milieu de l'image
          de l'en-tête, jusqu'à ce qu'elle soit faite. */}
      {updateCallVisible ? (
        <div className="header-update-call">
          <button type="button" onClick={onCheckForUpdate} disabled={checkingAppUpdate}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
            {checkingAppUpdate ? "Mise à jour…" : "Faire la mise à jour"}
          </button>
        </div>
      ) : null}
      <div className="header-command-area">
        <div className="header-control-cluster">
          <div className="header-actions">
            <Suspense fallback={null}>
              <NoteReminderButton demoMode={demoMode} notify={notify} showSuccess={showSuccess} />
            </Suspense>
            {/* La mise à jour reste à portée de doigt, au gabarit des autres
                commandes ; une pastille signale une version prête. */}
            <button
              className={`header-update-button${appUpdateAvailable ? " update-available" : ""}${checkingAppUpdate ? " checking" : ""}`}
              type="button"
              onClick={onCheckForUpdate}
              disabled={checkingAppUpdate}
              aria-label={updateLabel}
              title={updateLabel}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                <path d="M20 4v7h-7" />
              </svg>
              {appUpdateAvailable ? <em className="header-update-dot" aria-hidden="true" /> : null}
            </button>
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
                {unreadFeedbackCount > 0 ? <em className="account-feedback-badge" role="status" aria-label={unreadLabel}>{unreadFeedbackCount > 9 ? "9+" : unreadFeedbackCount}</em> : null}
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
                      <span>Touchez l’icône ↻ en haut de l’écran pour l’installer.</span>
                    </div>
                  ) : null}
                  {/* L'apparence est un réglage personnel : elle vit avec le compte. */}
                  <ThemeSwitch />
                  {/* Les outils de l'ancien menu principal, sous l'apparence. */}
                  <button className="account-menu-data" type="button" role="menuitem" onClick={onOpenDataManagement}>Mes données</button>
                  {install ? <button className="account-menu-data" type="button" role="menuitem" disabled={!install.available} onClick={install.onInstall}>
                    Installer l’application{install.available ? null : <small>Disponible après connexion</small>}
                  </button> : null}
                  {onOpenFeedback ? <button className="account-menu-data" type="button" role="menuitem" onClick={onOpenFeedback}>
                    Messagerie interne{unreadFeedbackCount > 0 ? <small>{unreadLabel}</small> : null}
                  </button> : null}
                  {onOpenAdminTools && <button className="account-menu-data" type="button" role="menuitem" onClick={onOpenAdminTools}>Outils administrateur</button>}
                  <button className="account-menu-leave" type="button" role="menuitem" onClick={onDisconnect}>
                    Se déconnecter
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {/* « Que cherchez-vous ? » : au même endroit dans chaque en-tête, en bas
          à gauche, quelle que soit la longueur du titre. Une mise à jour en
          attente prend sa place, en bas de l'en-tête : la pastille revient
          une fois la mise à jour faite. */}
      {onOpenHelp && !updateCallVisible ? (
        <button type="button" className="header-help-button" aria-haspopup="dialog" onClick={onOpenHelp}>
          <span className="header-help-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          </span>
          Que cherchez-vous ?
          <span className="header-help-go" aria-hidden="true">›</span>
        </button>
      ) : null}
    </header>
  );
}

