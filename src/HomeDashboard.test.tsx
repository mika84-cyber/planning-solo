import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "./HomeDashboard";

const baseProps = {
  now: new Date(2026, 8, 3),
  group: 2,
  hasConfiguredGroup: false,
  today: { tone: "work", status: "Travail", nextWork: new Date(2026, 8, 4) },
  totalLeaveRemaining: 20,
  remainingWorkedDaysThisYear: 50,
  importantAlert: "",
  setupItems: [{
    id: "planning-group",
    title: "Choisir votre groupe de planning",
    intro: "Choisissez votre groupe de planning pour afficher correctement vos jours de travail.",
    detail: "Indispensable pour afficher vos jours.",
    actionLabel: "Choisir",
    onAction: vi.fn(),
  }],
  setupDismissKey: "planning:test-setup-dismissed",
  hasAnyNote: false,
  noteQuery: "",
  onNoteQueryChange: vi.fn(),
  noteSearchResults: [],
  upcoming: [],
  renderNoteItems: () => null,
  onChooseGroup: vi.fn(),
  onOpenNextWork: vi.fn(),
  onOpenLeave: vi.fn(),
  onOpenPayAlert: vi.fn(),
  onAddNote: vi.fn(),
};

describe("HomeDashboard", () => {
  it("ne répète pas sur l’accueil les actions déjà accessibles dans la navigation", () => {
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(html).not.toContain("Accès rapide");
    expect(html).not.toContain("Trouver un document");
  });

  it("alerte sur les informations importantes encore manquantes", () => {
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} />);
    expect(html).toContain("Informations à compléter");
    expect(html).toContain("Choisir votre groupe de planning");
    expect(html).toContain("Pour bien démarrer");
    expect(html).toContain("Choisissez votre groupe de planning pour afficher correctement vos jours de travail.");
    expect(html).toContain("Ne plus me le demander");
  });

  it("affiche un message général lorsque plusieurs rubriques sont à compléter", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      setupItems={[
        ...baseProps.setupItems,
        {
          id: "pay-profile",
          title: "Compléter votre profil de paie",
          intro: "Ce texte propre au profil ne doit pas devenir le résumé général.",
          detail: "Indiquez votre statut et votre quotité.",
          actionLabel: "Compléter",
          onAction: vi.fn(),
        },
      ]}
    />);
    expect(html).toContain("Plusieurs informations sont encore nécessaires");
    expect(html).toContain("Complétez les rubriques ci-dessous selon votre situation.");
    expect(html).not.toContain("Ce texte propre au profil ne doit pas devenir le résumé général.");
  });

  it("retire l’alerte lorsque la configuration est complète", () => {
    const html = renderToStaticMarkup(<HomeDashboard {...baseProps} setupItems={[]} />);
    expect(html).not.toContain("Informations à compléter");
  });

  it("précise une demi-journée sur le prochain jour travaillé", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      today={{ ...baseProps.today, nextWorkHalfLeaveLabel: "1/2 journée posée le matin" }}
    />);
    expect(html).toContain("vendredi 04/09/26 — 1/2 journée posée le matin");
  });

  it("précise une demi-journée posée l’après-midi", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      today={{ ...baseProps.today, nextWork: new Date(2026, 8, 6, 12), nextWorkHalfLeaveLabel: "1/2 journée posée l’après-midi" }}
    />);
    expect(html).toContain("dimanche 06/09/26 — 1/2 journée posée l’après-midi");
  });

  it("conserve le groupe dans Aujourd’hui quand une demi-journée reste travaillée", () => {
    const html = renderToStaticMarkup(<HomeDashboard
      {...baseProps}
      today={{ ...baseProps.today, status: "1/2 journée posée l’après-midi", todayGroupLabel: "Avec le groupe 3" }}
    />);
    expect(html).toContain("Avec le groupe 3");
  });
});
