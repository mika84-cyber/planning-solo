import type { RefObject } from "react";

export const MAIN_SECTION_ORDER = [
  "home",
  "leave",
  "pay",
  "pdf",
  "program",
  "forms",
  "contacts",
] as const;

export type MainSection = (typeof MAIN_SECTION_ORDER)[number];
export type PayScreen = "overview" | "allowances" | "payslip";

const MENU_ITEMS: ReadonlyArray<readonly [MainSection, string, string, string]> = [
  ["home", "Accueil", "Aujourd’hui, notes et planning", "01"],
  ["leave", "Congés et récupérations", "Soldes, CET, heures sup et mécénats", "02"],
  ["pay", "Ma paie", "Estimations, primes et bulletins", "03"],
  ["pdf", "Télécharger les plannings en PDF", "Choisir le planning puis générer le document", "04"],
  ["program", "Programmation GP", "Expositions et événements par espace", "05"],
  ["forms", "Formulaires utiles", "Expo, SAP, Brantôme et tickets repas", "06"],
  ["contacts", "Contacts utiles", "Pompidou et GP‑RMN", "07"],
];

function headerTitle(section: MainSection, payScreen: PayScreen) {
  if (section === "home") return "Accueil";
  if (section === "leave") return "Congés et récupérations";
  if (section === "pdf") return "Plannings PDF";
  if (section === "forms") return "Formulaires";
  if (section === "program") return "Programmation GP";
  if (section === "contacts") return "Contacts";
  if (payScreen === "allowances") return "Primes et jours fériés";
  if (payScreen === "payslip") return "Bulletins et estimations";
  return "Ma paie";
}

function headerClass(section: MainSection) {
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
  accountMenuRef: RefObject<HTMLDivElement | null>;
  accountButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleAccount: () => void;
  onOpenDataManagement: () => void;
  onDisconnect: () => void;
  onOpenMainMenu: () => void;
  onCheckForUpdate: () => void;
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
  accountMenuRef,
  accountButtonRef,
  onToggleAccount,
  onOpenDataManagement,
  onDisconnect,
  onOpenMainMenu,
  onCheckForUpdate,
}: AppHeaderProps) {
  return (
    <header className={headerClass(homeSection)}>
      <div className="top-header-title">
        <p className="eyebrow">Planning Solo</p>
        <h1>{headerTitle(homeSection, payScreen)}</h1>
      </div>
      <div className="header-command-area">
        <div className="header-control-cluster">
          <div className="header-actions">
            <div className="account-menu" ref={accountMenuRef}>
              <button
                className={`account-button${accountMenuOpen ? " open" : ""}`}
                type="button"
                ref={accountButtonRef}
                onClick={onToggleAccount}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Compte"
              >
                {(userEmail[0] || "M").toUpperCase()}
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
                      <span>Utilisez le bouton rouge en haut de l’écran pour l’installer.</span>
                    </div>
                  ) : null}
                  <button className="account-menu-data" type="button" role="menuitem" onClick={onOpenDataManagement}>
                    Gérer mes données
                  </button>
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
          </button>
        </div>
        <button
          className={`app-update-button header-update-button${checkingAppUpdate ? " checking" : ""}${appUpdateAvailable ? " update-available" : ""}`}
          type="button"
          onClick={onCheckForUpdate}
          disabled={checkingAppUpdate}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 4v7h-7" />
          </svg>
          {checkingAppUpdate
            ? "Chargement de la mise à jour…"
            : appUpdateAvailable
              ? "Vous avez une mise à jour"
              : "Vérifier les mises à jour"}
        </button>
      </div>
    </header>
  );
}

type MainMenuProps = {
  open: boolean;
  homeSection: MainSection;
  onClose: () => void;
  onNavigate: (section: MainSection) => void;
  onOpenGuide: () => void;
};

export function MainMenu({ open, homeSection, onClose, onNavigate, onOpenGuide }: MainMenuProps) {
  if (!open) return null;
  return (
    <div
      className="main-menu-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="main-menu-drawer" id="main-menu-drawer" aria-label="Menu principal">
        <header>
          <div><span className="step-label">Planning Solo</span><h2>Menu principal</h2></div>
          <button type="button" onClick={onClose} aria-label="Fermer le menu">×</button>
        </header>
        <nav>
          {MENU_ITEMS.map(([key, title, detail, index]) => (
            <button
              key={key}
              type="button"
              className={homeSection === key ? "active" : ""}
              aria-current={homeSection === key ? "page" : undefined}
              onClick={() => onNavigate(key)}
            >
              <span className="main-menu-index" aria-hidden="true">{index}</span>
              <span className="main-menu-copy"><strong>{title}</strong><small>{detail}</small></span>
              <span className="main-menu-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </nav>
        <div className="main-menu-secondary">
          <button type="button" className="guide-menu-entry" onClick={onOpenGuide}>
            <span className="main-menu-index" aria-hidden="true">?</span>
            <span className="main-menu-copy"><strong>Mode d’emploi</strong><small>Retrouver toutes les fonctions</small></span>
            <span className="main-menu-chevron" aria-hidden="true">›</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
