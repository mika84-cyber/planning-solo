import { renderToStaticMarkup } from "react-dom/server";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AdaptiveNavigation, AppHeader } from "./AppNavigation";

const headerProps = {
  homeSection: "home" as const, payScreen: "overview" as const, userEmail: "mika@example.fr", fullName: "Mika",
  accountMenuOpen: false, checkingAppUpdate: false, appUpdateAvailable: false, demoMode: true, unreadFeedbackCount: 0,
  notify: vi.fn(), accountMenuRef: createRef<HTMLDivElement>(), accountButtonRef: createRef<HTMLButtonElement>(),
  onToggleAccount: vi.fn(), onDisconnect: vi.fn(), onCheckForUpdate: vi.fn(), onOpenDataManagement: vi.fn(),
};

describe("navigation principale", () => {
  it("garde deux commandes rondes, sans menu principal, et le titre de la programmation GP", () => {
    const html = renderToStaticMarkup(<AppHeader {...headerProps} homeSection="program" unreadFeedbackCount={2} />);
    expect(html).toContain("<h1><span>Programme</span> <span>GP</span></h1>");
    expect(html).not.toContain("main-menu");
    expect(html).not.toContain("Ouvrir le menu principal");
    // Les messages non lus de l'administrateur se lisent sur le bouton du compte.
    expect(html).toMatch(/<button class="account-button"[^>]*>M<em class="account-feedback-badge" role="status" aria-label="2 messages non lus">2<\/em><\/button>/);
    expect(html).not.toContain("notification-button");
  });

  it("range Mes données, l’installation et la messagerie dans le menu du compte", () => {
    const user = renderToStaticMarkup(<AppHeader {...headerProps} accountMenuOpen install={{ available: false, onInstall: vi.fn() }} />);
    const items = (html: string) => [...html.matchAll(/role="menuitem"[^>]*>([^<]+)/g)].map((match) => match[1]);
    expect(items(user)).toEqual(["Mes données", "Installer l’application", "Se déconnecter"]);
    expect(user).toContain("Installer l’application<small>Disponible après connexion</small>");
    // Les comptes non administrateurs n’ont pas de messagerie.
    expect(user).not.toContain("Messagerie interne");
    const admin = renderToStaticMarkup(<AppHeader
      {...headerProps}
      accountMenuOpen
      unreadFeedbackCount={3}
      onOpenFeedback={vi.fn()}
      onOpenAdminTools={vi.fn()}
    />);
    expect(items(admin)).toEqual(["Mes données", "Messagerie interne", "Outils administrateur", "Se déconnecter"]);
    expect(admin).toContain("Messagerie interne<small>3 messages non lus</small>");
  });

  it("signale la mise à jour par une seule pastille, sur l’icône ↻", () => {
    const html = renderToStaticMarkup(<AppHeader {...headerProps} appUpdateAvailable />);
    expect(html).toContain('aria-label="Compte — mise à jour disponible"');
    expect(html).not.toContain("account-update-dot");
    expect(html).toContain("header-update-dot");
  });

  it("place la mise à jour dans l’en-tête, avec une pastille quand une version attend", () => {
    const idle = renderToStaticMarkup(<AppHeader {...headerProps} appUpdateAvailable={false} />);
    expect(idle).toContain('class="header-update-button"');
    expect(idle).toContain('aria-label="Vérifier les mises à jour"');
    expect(idle).not.toContain("header-update-dot");
    const ready = renderToStaticMarkup(<AppHeader {...headerProps} appUpdateAvailable />);
    expect(ready).toContain('aria-label="Installer la mise à jour"');
    expect(ready).toContain("header-update-dot");
    expect(ready.indexOf("header-update-button")).toBeLessThan(ready.indexOf("account-button"));
  });

  it("propose une navigation adaptative sans numéros et marque la rubrique active", () => {
    const html = renderToStaticMarkup(<AdaptiveNavigation homeSection="colleagues" onNavigate={vi.fn()} />);
    // Les six rubriques sont toujours dans le dock ; seule la rubrique en
    // cours porte aria-current.
    expect(html).toContain("section-dock");
    expect(html.match(/<button/g)).toHaveLength(6);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('class="active" aria-current="page" aria-label="Collègues"');
    expect(html).toContain('aria-label="Programme"');
    expect(html).toContain('aria-label="Documents"');
    expect(html).not.toContain("compass");
    expect(html).toContain("<svg");
    expect(html).not.toContain('aria-label="Plus"');
    expect(html).not.toContain('aria-hidden="true">+</span>');
    expect(html).not.toContain(">01<");
    expect(html).not.toContain("Mode d’emploi");
  });

});
