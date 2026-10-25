import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppShellChrome } from "./AppShellChrome";
import type { InstallPromptEvent } from "./useInstallPrompt";

const noop = vi.fn();
const installPrompt = { prompt: noop, userChoice: Promise.resolve({ outcome: "accepted" as const }) } as unknown as InstallPromptEvent;

const baseProps: ComponentProps<typeof AppShellChrome> = {
  now: new Date(2026, 8, 3),
  group: 2,
  demoMode: false,
  userEmail: "mika@example.org",
  isProgramAdmin: false,
  actualProgramAdmin: false,
  programAdminKnown: true,
  admin: {
    guestPreview: false,
    setGuestPreview: noop,
    adminToolsOpen: false,
    setAdminToolsOpen: noop,
    setAdminRevision: noop,
  },
  installation: { enabled: false, installPrompt: null, installApp: noop },
  shell: {
    homeSection: "home",
    setHomeSection: noop,
    accountMenuOpen: false,
    setAccountMenuOpen: noop,
    mainMenuOpen: false,
    setMainMenuOpen: noop,
    checkingAppUpdate: false,
    appUpdateAvailable: false,
    appUpdatePromptOpen: false,
    accountMenuRef: { current: null },
    accountButtonRef: { current: null },
    setDataManagementOpen: noop,
    setFeedbackOpen: noop,
  },
  pay: { payScreen: "overview", setPayScreen: noop, setPayView: noop, setPayVerificationRequested: noop },
  calendar: { entries: {}, periods: [], formProfile: null, recoveryUses: [] },
  allowanceValues: {
    baseSalary: 1800,
    sundayCarryover: 0,
    sundayCarryoverYear: undefined,
    sundayCarryoverMonth: undefined,
    sundayCarryoverFromYear: undefined,
    sundayCarryoverFromMonth: undefined,
  },
  feedbackMessaging: { unreadCount: 0 },
  notify: noop,
  showSuccess: noop,
  help: { openPlanningPdf: noop, openBlankForm: noop },
  actions: { navigateFromShell: noop, checkForAppUpdate: noop, disconnect: noop },
};

describe("AppShellChrome", () => {
  it("rend l’en-tête et la navigation de la rubrique ouverte", () => {
    const html = renderToStaticMarkup(<AppShellChrome {...baseProps} />);
    expect(html).toContain("Planning Solo");
    expect(html).toContain('data-section="home"');
    expect(html).toContain('aria-label="Navigation principale"');
    expect(html).toContain('data-section="home" class="active" aria-current="page"');
    // « Que cherchez-vous ? » sous le nom de la page ; la fenêtre reste fermée.
    expect(html).toMatch(/<\/h1><button type="button" class="header-help-button" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true">.*?<\/svg>Que cherchez-vous \?<\/button><\/div>/);
    expect(html).not.toContain("help-sheet");
    // Fermés : ni menu principal, ni aperçu invité, ni proposition d’installation.
    expect(html).not.toContain("Menu principal");
    expect(html).not.toContain("Quitter l’aperçu");
    expect(html).not.toContain("app-install-notice");
  });

  it("marque l’écran de paie ouvert dans l’en-tête", () => {
    const html = renderToStaticMarkup(
      <AppShellChrome
        {...baseProps}
        shell={{ ...baseProps.shell, homeSection: "pay" }}
        pay={{ ...baseProps.pay, payScreen: "allowances" }}
      />,
    );
    expect(html).toContain('data-section="pay"');
    expect(html).toContain('data-pay-screen="allowances"');
  });

  it("appelle à faire la mise à jour tant que la fenêtre de mise à jour n’est pas ouverte", () => {
    const call = renderToStaticMarkup(
      <AppShellChrome {...baseProps} shell={{ ...baseProps.shell, appUpdateAvailable: true }} />,
    );
    expect(call).toContain("Faire la mise à jour");
    const prompted = renderToStaticMarkup(
      <AppShellChrome {...baseProps} shell={{ ...baseProps.shell, appUpdateAvailable: true, appUpdatePromptOpen: true }} />,
    );
    expect(prompted).not.toContain("Faire la mise à jour");
  });

  it("ouvre le menu principal à la demande", () => {
    const html = renderToStaticMarkup(
      <AppShellChrome {...baseProps} shell={{ ...baseProps.shell, mainMenuOpen: true }} />,
    );
    expect(html).toContain("Menu principal");
    expect(html).toContain("Fermer le menu");
  });

  it("propose l’installation aux seuls invités, une fois le rôle connu", () => {
    const installation = { enabled: true, installPrompt, installApp: noop };
    const guest = renderToStaticMarkup(<AppShellChrome {...baseProps} installation={installation} />);
    expect(guest).toContain("app-install-notice");
    const unknownRole = renderToStaticMarkup(
      <AppShellChrome {...baseProps} installation={installation} programAdminKnown={false} />,
    );
    expect(unknownRole).not.toContain("app-install-notice");
    const admin = renderToStaticMarkup(
      <AppShellChrome {...baseProps} installation={installation} isProgramAdmin actualProgramAdmin />,
    );
    expect(admin).not.toContain("app-install-notice");
  });

  it("signale l’aperçu invité de l’administrateur et permet d’en sortir", () => {
    const html = renderToStaticMarkup(
      <AppShellChrome
        {...baseProps}
        actualProgramAdmin
        isProgramAdmin={false}
        admin={{ ...baseProps.admin, guestPreview: true }}
      />,
    );
    expect(html).toContain("admin-preview-banner");
    expect(html).toContain("Quitter l’aperçu");
  });
});
