import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayslipCheckSection } from "./PayslipCheckSection";

const payDrafts = {
  baseSalary: "",
  ifse: "",
  carenceDay: "",
  otherFixed: "",
  cia: "",
  netRatioFixed: "",
  netRatioVariable: "",
  navigo: "",
  mealVoucherDeduction: "",
  pasRate: "",
};

const baseProps = {
  payYear: "2026",
  hasPayProfile: true,
  helpOpen: true,
  setHelpOpen: vi.fn(),
  missing: false,
  estimateDetails: <section data-testid="estimate">Estimation mensuelle</section>,
  isContractuel: true,
  importBusy: false,
  importMode: null,
  importError: "",
  importResult: null,
  onImport: vi.fn(),
  check: null,
  checkError: "",
  needsPeriod: false,
  fallbackMonth: 7,
  setFallbackMonth: vi.fn(),
  fallbackYear: 2026,
  setFallbackYear: vi.fn(),
  onApplyFallbackPeriod: vi.fn(),
  allowances: { year: 2026, monthly: [{ index: 7, sundayCount: 2 }] },
  displayedMonth: 7,
  review: null,
  unplannedCarence: false,
  resultDetailsOpen: false,
  setResultDetailsOpen: vi.fn(),
  grossForMonth: vi.fn(() => 2500),
  baseSalary: 1900,
  ifse: 0,
  overtime: { totalMinutes: 0, amount: 0 },
  mecenat: { totalMinutes: 0, grossAmountCents: 0 },
  onReportMissingSundays: vi.fn(),
  nextSundayPayout: vi.fn(() => null),
  sundayCarryover: 0,
  sundayCarryoverMonth: undefined,
  sundayCarryoverYear: undefined,
  onClearSundayCarryover: vi.fn(),
  rateSamples: [],
  rateCalibration: {
    totalCount: 0,
    usableCount: 0,
    missing: [],
    reason: "need-more-readable" as const,
  },
  sickLeaves: { total: 0, arrets: [] },
  paySettingsOpen: false,
  setPaySettingsOpen: vi.fn(),
  missingFields: [],
  carenceDay: 0,
  otherFixed: 57,
  cia: 0,
  netRatioFixed: 79.41,
  netRatioVariable: 89.92,
  navigo: 0,
  mealVoucherDeduction: 0,
  pasRate: 0,
  payDrafts,
  setPayDrafts: vi.fn(),
  savingPay: null,
  onSavePayAmount: vi.fn(),
  ciaMonth: undefined,
  onSaveCiaMonth: vi.fn(),
};

describe("PayslipCheckSection", () => {
  it("conserve les parcours de vérification et de calibration", () => {
    const html = renderToStaticMarkup(<PayslipCheckSection {...baseProps} />);
    expect(html).toContain("Comment ça marche");
    expect(html).toContain("Vérifier un bulletin");
    expect(html).toContain("Choisir le bulletin à vérifier");
    expect(html).toContain("Affiner mes estimations");
    expect(html).toContain("Choisir plusieurs bulletins");
    expect(html).toContain("Éléments de paie");
    expect(html).toContain("Estimation mensuelle");
  });

  it("demande la période lorsque le bulletin ne permet pas de la reconnaître", () => {
    const html = renderToStaticMarkup(
      <PayslipCheckSection
        {...baseProps}
        check={{ name: "bulletin.pdf", reading: { sundaysBeyondTen: 0 } }}
        needsPeriod
      />,
    );
    expect(html).toContain("Période non reconnue");
    expect(html).toContain("Mois du bulletin");
    expect(html).toContain("Année du bulletin");
    expect(html).toContain("Utiliser cette période");
  });

  it("conserve le verdict et le tableau détaillé d'un bulletin reconnu", () => {
    const html = renderToStaticMarkup(
      <PayslipCheckSection
        {...baseProps}
        check={{
          name: "bulletin-aout.pdf",
          reading: {
            month: 7,
            year: 2026,
            sundaysBeyondTen: 2,
            gross: 2500,
            baseSalary: 1900,
          },
        }}
        review={{
          verdict: "Comparaison disponible",
          tone: "unknown",
          issues: [],
          verified: [{ key: "gross", label: "Cumul brut", found: 2500, expected: 2500 }],
          unavailable: [],
        }}
        resultDetailsOpen
      />,
    );

    expect(html).toContain("Période reconnue");
    expect(html).toContain("Comparaison disponible");
    expect(html).toContain("Cumul brut");
    expect(html).toContain("bulletin-aout.pdf");
  });

  it("conserve les arrêts maladie et l'édition des paramètres", () => {
    const html = renderToStaticMarkup(
      <PayslipCheckSection
        {...baseProps}
        isContractuel={false}
        sickLeaves={{
          total: 120,
          arrets: [{
            id: "sick-1",
            from: "2026-08-03",
            to: "2026-08-05",
            days: 3,
            reducedDays: 2,
            total: 120,
          }],
        }}
        paySettingsOpen
      />,
    );

    expect(html).toContain("Arrêts maladie 2026");
    expect(html).toContain("3 jours · carence + 2 à 10 %");
    expect(html).toContain("Traitement de base");
    expect(html).toContain("Mois du CIA");
  });
});
