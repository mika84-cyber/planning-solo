import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayDashboard, type PayDashboardAlert } from "./PayDashboard";

const alerts: PayDashboardAlert[] = Array.from({ length: 5 }, (_, index) => ({
  id: `alert-${index + 1}`,
  title: `Action ${index + 1}`,
  detail: `Détail ${index + 1}`,
  actionLabel: "Corriger",
  onAction: vi.fn(),
}));

const baseProps = {
  month: 9,
  year: 2026,
  gross: 2_600,
  grossComplete: true,
  net: 2_080,
  profileLabel: "Estimation réalisée avec votre profil de paie 2026.",
  reliability: { tone: "estimated" as const, label: "Estimation", detail: "Profil annuel" },
  alerts,
  variables: [{ key: "sundays", label: "Dimanches (2)", quantity: "2 × 60 €", amount: 120 }],
  verificationContent: <div>Choisir le PDF</div>,
  settingsContent: <div>Mon profil de paie</div>,
  settingsOpen: false,
  onPreviousMonth: vi.fn(),
  onNextMonth: vi.fn(),
  onToday: vi.fn(),
  onOpenEstimateDetails: vi.fn(),
  onOpenAllowances: vi.fn(),
  onToggleSettings: vi.fn(),
};

describe("PayDashboard", () => {
  it("place le mois et l'estimation avant les éléments secondaires", () => {
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} />);
    expect(html).toContain("octobre 2026");
    expect(html).toContain("Net estimé");
    expect(html).toContain("2 080,00 €");
    expect(html).toContain("Voir le détail du calcul");
    expect(html.indexOf("Net estimé")).toBeLessThan(html.indexOf("Prévus sur cette paie"));
  });

  it("montre trois alertes actionnables au maximum et replie les suivantes", () => {
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} />);
    expect(html).toContain("Action 1");
    expect(html).toContain("Action 3");
    expect(html).not.toContain("Action 4");
    expect(html).toContain("Voir toutes les vérifications (5)");
    expect(html).toContain("5 actions");
    expect((html.match(/>Corriger</g) || []).length).toBe(3);
  });

  it("affiche un état rassurant seulement lorsqu'aucune action n'est nécessaire", () => {
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} alerts={[]} />);
    expect(html).toContain("Tout est à jour");
    expect(html).toContain("pay-dashboard-checks all-clear");
    expect(html).not.toContain("pay-dashboard-alert-symbol");
    expect(html).not.toContain("Voir toutes les vérifications");
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
