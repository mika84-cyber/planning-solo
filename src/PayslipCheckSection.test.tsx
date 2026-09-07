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
  part: "verification" as const,
  accountId: "demo@test.local",
  payYear: "2026",
  hasPayProfile: true,
  helpOpen: true,
  setHelpOpen: vi.fn(),
  missing: false,
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
  onCreatePayProfile: vi.fn(async () => undefined),
  ciaMonth: undefined,
  onSaveCiaMonth: vi.fn(),
};

describe("PayslipCheckSection", () => {
  it("conserve les parcours de vérification et de calibration", () => {
    const html = renderToStaticMarkup(<><PayslipCheckSection {...baseProps} /><PayslipCheckSection {...baseProps} part="settings" /></>);
    expect(html).toContain("Comment ça marche");
    expect(html).not.toContain("Comparer avec le bulletin réel");
    expect(html).not.toContain("Un seul PDF suffit");
    expect(html).toContain("Choisir le bulletin à vérifier");
    expect(html).toContain("Choisir PDF ou photo");
    expect(html).not.toContain("choisissez les 2 photos ensemble");
    expect(html).toMatch(/payslip-file-drop[\s\S]*?<input[^>]*multiple=""/);
    expect(html).not.toContain("Prendre une photo");
    expect(html).not.toContain("Traitement local");
    expect(html).toContain("Affiner mes estimations");
    expect(html).toContain("Choisir plusieurs PDF ou photos");
    expect(html).toContain("aucune saisie manuelle n’est");
    expect(html).toContain("montants de primes variés");
    expect(html).toContain("Éléments de paie");
  });

  it("propose de créer explicitement le profil de l’année affichée", () => {
    const html = renderToStaticMarkup(<PayslipCheckSection {...baseProps} part="settings" payYear="2027" hasPayProfile={false} />);
    expect(html).toContain("Utiliser ces valeurs pour 2027");
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
    expect(html).toContain("Tout est OK");
    expect(html).toContain("Signaler une anomalie");
  });

  it("détaille automatiquement toutes les différences reconnues", () => {
    const html = renderToStaticMarkup(
      <PayslipCheckSection
        {...baseProps}
        check={{
          name: "bulletin-aout.pdf",
          reading: { month: 7, year: 2026, sundaysBeyondTen: 1, gross: 2470, pasRate: 2.1 },
        }}
        review={{
          verdict: "3 points à vérifier",
          tone: "warning",
          issues: [
            { key: "gross", label: "Cumul brut", found: 2470, expected: 2500 },
            { key: "pas-rate", label: "Taux d’imposition (PAS)", found: 2.1, expected: 2.5 },
            { key: "sundays", label: "Dimanches payés", found: 1, expected: 2, tolerance: 1 },
          ],
          verified: [
            { key: "gross", label: "Cumul brut", found: 2470, expected: 2500 },
            { key: "pas-rate", label: "Taux d’imposition (PAS)", found: 2.1, expected: 2.5 },
            { key: "sundays", label: "Dimanches payés", found: 1, expected: 2, tolerance: 1 },
          ],
          unavailable: [],
        }}
      />,
    );

    expect(html).toContain("Écarts détaillés ci-dessous");
    expect(html).toContain("Taux d’imposition (PAS)");
    expect(html).toContain("0,4 %");
    expect(html).toContain("Dimanches payés");
    expect(html).toContain("Anomalies ou observations");
    expect(html).toContain("Enregistrer les anomalies");
  });

  it("conserve les arrêts maladie et l'édition des paramètres", () => {
    const html = renderToStaticMarkup(
      <PayslipCheckSection
        {...baseProps}
        part="settings"
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
