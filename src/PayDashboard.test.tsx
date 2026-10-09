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
  it("présente la paie comme un bulletin simplifié", () => {
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} />);
    expect(html).toContain("Octobre 2026");
    expect(html).toContain("Net estimé");
    expect(html).toMatch(/2\s080,00\s€/);
    expect(html).toContain("Les lignes de la paie");
    // Le mois en titre, une flèche de chaque côté.
    expect(html).toContain("Paie de");
    expect(html).toContain('aria-label="Mois précédent"');
    expect(html).toContain('aria-label="Mois suivant"');
    // Vérification, profil et réglages derrière leurs deux boutons.
    expect(html).toContain("Vérifier le bulletin");
    expect(html).toContain("Profil · réglages");
    // Le détail du calcul et les primes de l'année, côte à côte.
    expect(html).toContain("Détail du calcul");
    expect(html.match(/Primes et jours fériés/g)).toHaveLength(1);
    expect(renderToStaticMarkup(<PayDashboard {...baseProps} allowancesPending={4} />)).toContain("4 fériés à décider");
    expect(html).not.toContain("Mon profil de paie · toujours visible");
    expect(html.indexOf("Net estimé")).toBeLessThan(html.indexOf("Les lignes de la paie"));
    expect(html.indexOf("Les lignes de la paie")).toBeLessThan(html.indexOf("Vérifier le bulletin"));
  });

  it("regroupe les lignes du calcul et ouvre le détail des primes", () => {
    const calculation = {
      grossComposition: [
        { key: "base", label: "Traitement indiciaire", detail: "", amount: 1801.73 },
        { key: "residence", label: "Indemnité de résidence", detail: "", amount: 54.05 },
        { key: "ifse", label: "IFSE", detail: "", amount: 416.66 },
        { key: "sunday-flat", label: "Forfait mensuel de dimanches", detail: "", amount: 89.59 },
        { key: "sundays", label: "Dimanches (9)", detail: "", amount: 494.37 },
      ],
      grossDeductions: [],
      grossBeforeDeductions: 2856.4,
      variableAdditions: 494.37,
      netRatioFixed: 78.4,
      netRatioVariable: 86.2,
      estimatedContributions: 571.43,
      navigo: 0,
      mealVoucherDeduction: 0,
      netBeforeTax: 2284.97,
      pasRate: 1.7,
      incomeTax: 41.06,
      totalDeductions: 612.49,
    };
    const variables = [
      { key: "sundays", label: "Dimanches (9)", quantity: "dont 1 reporté", amount: 494.37 },
      { key: "holidays", label: "Jours fériés (1)", quantity: "compensation à décider", amount: 0 },
      { key: "overtime", label: "Heures supplémentaires (2 h 30)", quantity: "traitement de base à compléter", amount: null },
      { key: "mealVoucher", label: "Titres repas", quantity: "jamais prélevés en décembre", amount: 72 },
    ];
    const html = renderToStaticMarkup(<PayDashboard {...baseProps} calculation={calculation} variables={variables} />);
    expect(html).toContain("Traitement indiciaire");
    // Les indemnités sur une ligne, chaque montant dans le détail ; le
    // forfait des dimanches rejoint les primes, comme dans le détail du calcul.
    expect(html).toContain("résidence 54,05 · IFSE 416,66");
    expect(html).toMatch(/Forfait dimanches[\s\S]*le même chaque mois[\s\S]*\+ 89,59/);
    // Chaque prime avec son détail.
    expect(html).toMatch(/Dimanches \(9\)[\s\S]*dont 1 reporté[\s\S]*\+ 494,37/);
    expect(html).toMatch(/Cotisations · impôt[\s\S]*cotisations 571,43 · impôt 41,06[\s\S]*− 612,49/);
    // Un montant inconnu ne compte pas pour zéro : il est signalé.
    expect(html).toMatch(/Jours fériés \(1\)[\s\S]*class="pending">à décider</);
    expect(html).toMatch(/Heures supplémentaires \(2 h 30\)[\s\S]*class="pending">à vérifier</);
    expect(html).toContain("2 montants en attente");
    expect(html).toContain("Hors 2 montants en attente");
    // En décembre, les titres repas non prélevés apparaissent barrés.
    expect(html).toMatch(/Titres repas[\s\S]*jamais prélevés en décembre[\s\S]*<s>− 72,00<\/s>/);
    expect(html).toContain("Fixe");
    expect(html).toContain("Primes du mois");
    expect(html).toContain("Retenues");
    // La frise dit où va le brut : le net, les cotisations, l'impôt.
    expect(html).toContain("Où va votre brut");
    expect(html).toMatch(/<li class="net"><span>Net<\/span> <b>2\s080,00<\/b>/);
    expect(html).toMatch(/<li class="contributions"><span>Cotisations<\/span> <b>571,43<\/b>/);
    expect(html).toMatch(/<li class="tax"><span>Impôt<\/span> <b>41,06<\/b>/);
  });

  it("dit sous le net si l’estimation a été vérifiée avec le bulletin", () => {
    expect(renderToStaticMarkup(<PayDashboard {...baseProps} />)).toContain(">Estimation<");
    const ok = renderToStaticMarkup(<PayDashboard {...baseProps} verification={{ tone: "ok", label: "Comparaison complète — aucun écart" }} />);
    expect(ok).toContain("Vérifiée avec le bulletin");
    const warning = renderToStaticMarkup(<PayDashboard {...baseProps} verification={{ tone: "warning", label: "2 points à vérifier" }} />);
    expect(warning).toContain("Bulletin : 2 points à vérifier");
    // La vérification est rendue d'emblée, masquée tant qu'on ne l'ouvre pas.
    expect(ok).toMatch(/id="pay-dashboard-verification"[^>]*hidden/);
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
    expect(html).toContain('aria-controls="pay-dashboard-verification"');
    // Les réglages ouverts déplient la zone profil · réglages.
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Mon profil de paie");
  });
});
