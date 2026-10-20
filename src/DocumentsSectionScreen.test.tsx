import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DocumentsSectionScreen } from "./DocumentsSectionScreen";

// Les rubriques elles-mêmes se chargent à part et ont leurs propres tests :
// ici, des témoins synchrones suffisent à vérifier laquelle est montée, et
// avec quelles données.
vi.mock("./appSections", () => ({
  UsefulFormsSection: ({ today, isAdmin }: { today: string; isAdmin: boolean }) => (
    <p>Formulaires du {today}{isAdmin ? " (administrateur)" : ""}</p>
  ),
  UsefulContactsSection: () => <p>Contacts</p>,
  GrandPalaisProgramSection: ({ guestPreview }: { guestPreview: boolean }) => (
    <p>Programmation GP{guestPreview ? " (aperçu invité)" : ""}</p>
  ),
  ColleaguePlanningPage: ({ initialName, ownGroup }: { initialName: string; ownGroup: number }) => (
    <p>Plannings des collègues · {initialName || "sans nom"} · groupe {ownGroup}</p>
  ),
}));

const noop = vi.fn();

const baseProps: ComponentProps<typeof DocumentsSectionScreen> = {
  now: new Date(2026, 8, 3),
  group: 2,
  demoMode: false,
  userEmail: "mika@example.org",
  isProgramAdmin: false,
  guestPreview: false,
  adminRevision: 0,
  shell: { homeSection: "home", prefetchedContacts: null },
  calendar: { periods: [], entries: {}, recoveryUses: [], formProfile: null },
  workDayMinutes: 420,
  exceptionalClosureFor: () => null,
  workAccident: { saveWorkAccident: noop, deleteWorkAccident: noop },
};

describe("DocumentsSectionScreen", () => {
  it("ne rend rien hors de ses trois rubriques", () => {
    for (const homeSection of ["home", "leave", "pay"] as const) {
      const html = renderToStaticMarkup(
        <DocumentsSectionScreen {...baseProps} shell={{ ...baseProps.shell, homeSection }} />,
      );
      expect(html).toBe("");
    }
  });

  it("monte Documents et contacts pour les rubriques pdf et forms, avec la date du jour", () => {
    for (const homeSection of ["pdf", "forms"] as const) {
      const html = renderToStaticMarkup(
        <DocumentsSectionScreen {...baseProps} shell={{ ...baseProps.shell, homeSection }} />,
      );
      expect(html).toContain("useful-resources-screen");
      expect(html).toContain("Formulaires du 2026-09-03");
      expect(html).not.toContain("Programmation GP");
      expect(html).not.toContain("Plannings des collègues");
    }
  });

  it("transmet le rôle d’administrateur et l’aperçu invité", () => {
    const admin = renderToStaticMarkup(
      <DocumentsSectionScreen {...baseProps} isProgramAdmin shell={{ ...baseProps.shell, homeSection: "forms" }} />,
    );
    expect(admin).toContain("Formulaires du 2026-09-03 (administrateur)");
    const preview = renderToStaticMarkup(
      <DocumentsSectionScreen {...baseProps} guestPreview shell={{ ...baseProps.shell, homeSection: "program" }} />,
    );
    expect(preview).toContain("Programmation GP (aperçu invité)");
    expect(preview).not.toContain("useful-resources-screen");
  });

  it("ouvre les plannings des collègues avec le nom du profil et le groupe", () => {
    const html = renderToStaticMarkup(
      <DocumentsSectionScreen
        {...baseProps}
        group={4}
        shell={{ ...baseProps.shell, homeSection: "colleagues" }}
        calendar={{
          ...baseProps.calendar,
          formProfile: { fullName: "Mika Dupont" } as NonNullable<typeof baseProps.calendar.formProfile>,
        }}
      />,
    );
    expect(html).toContain("Plannings des collègues · Mika Dupont · groupe 4");
  });
});
