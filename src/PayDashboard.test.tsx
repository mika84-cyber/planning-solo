import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayDashboard } from "./PayDashboard";

const baseProps = {
  month: 9,
  year: 2026,
  gross: 2_600,
  grossComplete: true,
  net: 2_080,
  profileLabel: "Estimation réalisée avec votre profil de paie 2026.",
  reliability: { tone: "estimated" as const, label: "Estimation", detail: "Profil annuel" },
  variables: [{ key: "sundays", label: "Dimanches (2)", quantity: "2 × 60 €", amount: 120 }],
  profileContent: <div>Mon profil de paie · toujours visible</div>,
  verificationContent: <div>Choisir le PDF</div>,
  settingsContent: <div>Réglages détaillés</div>,
  settingsOpen: false,
  onPreviousMonth: vi.fn(),
  onNextMonth: vi.fn(),
  onToday: vi.fn(),
  onOpenEstimateDetails: vi.fn(),
  onOpenAllowances: vi.fn(),
  onToggleSettings: vi.fn(),
};

describe("PayDashboard", () => {
  it("explique les informations manquantes sans masquer une estimation complète", () => {
    const missingFields = ["traitement de base", "taux de prélèvement"];
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} net={null} grossComplete={false} missingFields={missingFields} onCompleteEstimate={vi.fn()} />);
    expect(html).not.toContain("À compléter :");
    expect(html).toContain("Ajouter mon bulletin");
    expect(html).toContain("Votre estimation commence ici");
    expect(html).toContain('class="pay-import-secondary"');
    expect(html).toContain("Compléter manuellement si besoin");
    const complete = renderToStaticMarkup(<PayDashboard {...baseProps} missingFields={missingFields} />);
    expect(complete).not.toContain("Compléter manuellement si besoin");
  });
  it("place le mois et l'estimation avant les éléments secondaires", () => {
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} />);
    expect(html).toContain("Octobre 2026");
    expect(html).toContain("Net estimé");
    expect(html).toContain("2 080,00 €");
    expect(html).toContain("Voir le détail du calcul");
    expect(html).toContain("Mon profil de paie · toujours visible");
    expect(html).toContain("Primes et jours fériés");
    expect(html.indexOf("Net estimé")).toBeLessThan(html.indexOf("Mon profil de paie · toujours visible"));
    expect(html.indexOf("Net estimé")).toBeLessThan(html.indexOf("Prévus sur cette paie"));
    expect(html.indexOf("Prévus sur cette paie")).toBeLessThan(html.indexOf("Vérifier mon bulletin"));
    expect(html.indexOf("Vérifier mon bulletin")).toBeLessThan(html.indexOf("Mon profil de paie · toujours visible"));
    expect(html.match(/Primes et jours fériés/g)).toHaveLength(1);
  });

  it("ne montre plus le bloc d'actions utiles", () => {
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} />);
    expect(html).not.toContain("Actions utiles");
    expect(html).not.toContain("À vérifier");
    expect(html).not.toContain("pay-dashboard-checks");
  });

  it("conserve les intitulés et états accessibles", () => {
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} settingsOpen />);
    expect(html).toContain('aria-label="Choisir le mois de paie"');
    expect(html).toContain('aria-label="Mois précédent"');
    expect(html).toContain('aria-label="Mois suivant"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Mon profil de paie");
  });
});
