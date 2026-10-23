import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayEstimateDetails } from "./PayEstimateDetails";

describe("détail mensuel de la paie", () => {
  it("affiche le mois, le brut, le net et les commandes de navigation", () => {
    const html = renderToStaticMarkup(
      <PayEstimateDetails
        monthIndex={7}
        year={2026}
        gross={2500}
        grossEstimateComplete
        net={1980}
        calculation={{
          grossComposition: [
            { key: "base", label: "Traitement indiciaire", detail: "mensuel", amount: 2000 },
            { key: "ifse", label: "IFSE", detail: "mensuelle", amount: 500 },
          ],
          grossDeductions: [],
          grossBeforeDeductions: 2500,
          variableAdditions: 500,
          netRatioFixed: 79,
          netRatioVariable: 86,
          estimatedContributions: 470,
          navigo: 42,
          mealVoucherDeduction: 72,
          netBeforeTax: 2000,
          pasRate: 1,
          incomeTax: 20,
          totalDeductions: 562,
        }}
        overtime={{
          totalMinutes: 0,
          performedMonth: 6,
          performedYear: 2026,
          ready: false,
          amount: 0,
          hourlyBase: 0,
          lines: [],
        }}
        workQuota="full"
        mecenat={{ grossAmountCents: 0, lines: [] }}
        reliability={{
          tone: "exact",
          label: "Valeurs vérifiées avec le bulletin",
          detail: "Les montants du mois correspondent.",
        }}
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
      />,
    );

    // Le bandeau de la page la nomme déjà : ici, le mois entre ses flèches.
    expect(html).not.toContain("Détail de la paie du mois affiché");
    expect(html).toContain("Août 2026");
    expect(html).toContain("2 500,00 €");
    expect(html).toContain("1 980,00 €");
    expect(html).toContain('aria-label="Mois précédent"');
    expect(html).toContain('aria-label="Mois suivant"');
    expect(html).toContain("Valeurs vérifiées avec le bulletin");
    // Sous la cascade, plus de tableaux qui répètent ses montants avec un
    // autre vocabulaire : la composition du brut et le passage au net sont
    // les calculs de ses étapes.
    expect(html).not.toContain("Composition du brut");
    expect(html).not.toContain("Retenues et passage au net");
    expect(html).not.toContain("Cotisations estimées");
    expect(html).not.toContain("Net avant prélèvement à la source");
    // Du brut au net, étape par étape : le brut (dont primes), moins les
    // cotisations, le net avant impôt, moins l'impôt, le net. Chaque étape
    // se touche pour afficher son calcul.
    expect(html).toContain("Du brut au net");
    expect(html).toMatch(/<li><button[^>]*><i class="pay-total-dot" aria-hidden="true"><\/i><span class="pay-total-label">Brut du mois<small>traitement, indemnités et primes<\/small><\/span><span class="pay-total-value"><b>2.500,00.€<\/b><em>Voir le calcul<i aria-hidden="true">›<\/i><\/em><\/span>/);
    expect(html).toMatch(/<li class="sub"><button[^>]*><i class="pay-total-dot"[^>]*><\/i><span class="pay-total-label">dont primes du mois<\/span>/);
    expect(html).toMatch(/<li class="minus"><button[^>]*><i class="pay-total-dot"[^>]*><\/i><span class="pay-total-label">Cotisations sociales<small>retraite, CSG et CRDS<\/small><\/span><span class="pay-total-value"><b>− /);
    expect(html).toMatch(/<li class="sub"><button[^>]*><i class="pay-total-dot"[^>]*><\/i><span class="pay-total-label">Net avant impôt<\/span>/);
    expect(html).toMatch(/<li class="minus"><button[^>]*><i class="pay-total-dot"[^>]*><\/i><span class="pay-total-label">Impôt sur le revenu<small>prélèvement à la source · /);
    expect(html).toMatch(/<li class="net"><button[^>]*><i class="pay-total-dot"[^>]*><\/i><span class="pay-total-label">Net estimé<small>ce qui arrive sur votre compte<\/small><\/span><span class="pay-total-value"><b>1.980,00.€<\/b>/);
    expect(html).not.toContain("Touchez une case pour voir son calcul.");
    expect(html).not.toContain("Net estimé final");
    expect(html.match(/aria-controls="pay-total-explain"/g)!.length).toBeGreaterThanOrEqual(6);
    expect(html.match(/Voir le calcul/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it("ne répète pas une simple estimation avec le profil de l’année", () => {
    const html = renderToStaticMarkup(
      <PayEstimateDetails
        monthIndex={7}
        year={2026}
        gross={2500}
        grossEstimateComplete
        net={1980}
        calculation={{
          grossComposition: [{ key: "base", label: "Traitement indiciaire", detail: "mensuel", amount: 2500 }],
          grossDeductions: [],
          grossBeforeDeductions: 2500,
          variableAdditions: 0,
          netRatioFixed: 79,
          netRatioVariable: 86,
          estimatedContributions: 500,
          navigo: 0,
          mealVoucherDeduction: 0,
          netBeforeTax: 2000,
          pasRate: 1,
          incomeTax: 20,
          totalDeductions: 520,
        }}
        overtime={{ totalMinutes: 0, performedMonth: 6, performedYear: 2026, ready: false, amount: 0, hourlyBase: 0, lines: [] }}
        workQuota="full"
        mecenat={{ grossAmountCents: 0, lines: [] }}
        reliability={{
          tone: "estimated",
          label: "Valeurs enregistrées pour cette année",
          detail: "Estimation calculée avec le profil de paie 2026.",
          quiet: true,
        }}
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    expect(html).not.toContain("Valeurs enregistrées pour cette année");
    expect(html).not.toContain('class="pay-reliability');
  });
});
