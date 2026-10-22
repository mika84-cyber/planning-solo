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
  verificationRecords: {},
  onSaveVerification: vi.fn(),
  onRemoveVerification: vi.fn(),
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
  photoPending: false,
  onFinishPhotos: vi.fn(),
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
  onApplyPayslipValue: vi.fn(),
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
    expect(html).not.toContain("Affiner mes estimations");
    expect(html).toContain("Éléments de paie");
  });

  it("explique que les taux se calent dès le premier bulletin et s’affinent ensuite", () => {
    const html = renderToStaticMarkup(<PayslipCheckSection {...baseProps} part="settings" />);
    expect(html).toContain("Dès le premier bulletin, l’application cale ses deux taux net");
    expect(html).toContain("un bulletin d’un autre mois");
    expect(html).toContain("Vérifiez-les un par un, le même jour ou plus tard");
    expect(html).toContain("de chaque bulletin restent gardés dans votre compte");
    expect(html).toContain("lus comme les pages d’un seul bulletin");
    expect(html).not.toContain("Deux bulletins de mois");
    const settings = renderToStaticMarkup(<PayslipCheckSection {...baseProps} part="settings" paySettingsOpen />);
    expect(settings).toContain("calé sur votre premier bulletin, affiné à chaque bulletin vérifié ensuite");
    expect(settings).toContain("distingué du traitement dès qu’un bulletin aux primes différentes est vérifié");
  });

  it("invite à un bulletin aux primes différentes tant que les taux sont calés ensemble", () => {
    const check = { name: "bulletin.pdf", reading: { sundaysBeyondTen: 0, month: 7, year: 2026, gross: 2500, netBeforeTax: 1990, baseSalary: 1900 } };
    const review = { verdict: "Comparaison complète — aucun écart", tone: "ok" as const, issues: [], verified: [], unavailable: [] };
    const approximate = renderToStaticMarkup(
      <PayslipCheckSection {...baseProps} check={check} review={review}
        rateCalibration={{ rates: { netRatioFixed: 77.1, netRatioVariable: 87.3 }, totalCount: 1, usableCount: 1, missing: [], reason: "approximate" }}
        netRatioFixed={77.1} netRatioVariable={87.3} />,
    );
    expect(approximate).toContain("calés sur ce seul bulletin");
    expect(approximate).toContain("lors d’une prochaine visite");
    expect(approximate).toContain("distinguera alors le taux du traitement de celui des primes");
    const separated = renderToStaticMarkup(
      <PayslipCheckSection {...baseProps} check={check} review={review}
        rateCalibration={{ rates: { netRatioFixed: 77.84, netRatioVariable: 80 }, totalCount: 2, usableCount: 2, missing: [], reason: "ready" }}
        netRatioFixed={77.84} netRatioVariable={80} />,
    );
    expect(separated).not.toContain("Pour un net encore plus juste");
  });

  it("photographie les deux pages l’une après l’autre, sans conclure avant la seconde", () => {
    const html = renderToStaticMarkup(<PayslipCheckSection {...baseProps} />);
    expect(html).toContain("Un bulletin fait deux pages");
    expect(html).toMatch(/payslip-photo-drop[\s\S]*?<input[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*capture="environment"/);
    expect(html).toContain("Photographier la page 1");
    expect(html).not.toContain("Il n’y a pas d’autre page");
    // La page 1 lue (rubriques et brut), le net attendu sur la page 2.
    const pending = renderToStaticMarkup(
      <PayslipCheckSection
        {...baseProps}
        photoPending
        check={{ name: "IMG_1.jpg", reading: { sundaysBeyondTen: 0, month: 7, year: 2026, baseSalary: 1900, gross: 2500 } }}
        review={{ verdict: "1 point à vérifier", tone: "warning", issues: [], verified: [], unavailable: [] }}
      />,
    );
    expect(pending).toContain("Page 1 lue · photographiez la page 2");
    expect(pending).toContain("Le bas du bulletin, avec le net à payer.");
    expect(pending).toContain("Photographier la page 2");
    expect(pending).toContain("Choisir dans la galerie");
    expect(pending).toContain("Il n’y a pas d’autre page");
    expect(pending).toContain("Période reconnue");
    expect(pending).not.toContain("Votre conclusion");
    expect(pending).not.toContain("Pour un net encore plus juste");
    // La page 2 d'abord : c'est la page 1 qui manque.
    const reversed = renderToStaticMarkup(
      <PayslipCheckSection {...baseProps} photoPending check={{ name: "IMG_2.jpg", reading: { sundaysBeyondTen: 0, month: 7, year: 2026, netBeforeTax: 1990 } }} />,
    );
    expect(reversed).toContain("Page 2 lue · photographiez la page 1");
    expect(reversed).toContain("rubriques et le cumul brut");
  });

  it("propose, devant un écart, le geste qui l’explique", () => {
    const onApplyPayslipValue = vi.fn();
    const onChangeStatus = vi.fn();
    const check = { name: "bulletin.pdf", reading: { sundaysBeyondTen: 0, month: 7, year: 2026, gross: 2500, netBeforeTax: 1990, baseSalary: 1900, pasRate: 2.2, ifse: 416.66 } };
    const issues = [
      { key: "pas-rate", label: "Taux d’imposition (PAS)", found: 2.2, expected: 1.7, tolerance: 0.01 },
      { key: "status", label: "IFSE ou CIA", found: 416.66, expected: 0 },
      { key: "net-before-tax", label: "Net avant impôt", found: 1990, expected: 2010, tolerance: 0.5 },
    ];
    const review = { verdict: "3 points à vérifier", tone: "warning" as const, issues, verified: issues, unavailable: [] };
    const html = renderToStaticMarkup(
      <PayslipCheckSection {...baseProps} check={check} review={review} onApplyPayslipValue={onApplyPayslipValue} onChangeStatus={onChangeStatus} />,
    );
    expect(html).toContain('aria-label="Que s’est-il passé ?"');
    expect(html).toContain("Appliquer le taux du bulletin : 2,2 %");
    expect(html).toContain("Les impôts l’ont sans doute actualisé");
    expect(html).toContain("Passer mon statut en Fonctionnaire");
    // Le net sans geste simple n'a pas de bouton ; sans quoi exécuter le
    // changement de statut, le bouton ne se montre pas.
    expect(html.match(/payslip-gap-choice"/g)).toHaveLength(2);
    const withoutStatus = renderToStaticMarkup(<PayslipCheckSection {...baseProps} check={check} review={review} />);
    expect(withoutStatus).not.toContain("Passer mon statut en Fonctionnaire");
    expect(withoutStatus).toContain("Appliquer le taux du bulletin : 2,2 %");
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

  it("ne reporte pas les détails d’un bulletin sur un autre mois", () => {
    const html = renderToStaticMarkup(
      <PayslipCheckSection
        {...baseProps}
        displayedMonth={8}
        importMode="verify"
        importResult={{ applied: [{ label: "Traitement de base", value: "1 900 €" }], missing: [] }}
        check={{
          name: "bulletin-aout.pdf",
          reading: { month: 7, year: 2026, sundaysBeyondTen: 2, gross: 2500 },
        }}
        review={{
          verdict: "Comparaison disponible",
          tone: "unknown",
          issues: [],
          verified: [{ key: "gross", label: "Cumul brut", found: 2500, expected: 2500 }],
          unavailable: [],
        }}
        sundayCarryover={1}
        sundayCarryoverMonth={9}
        sundayCarryoverYear={2026}
      />,
    );

    expect(html).toContain("Choisir PDF ou photo");
    expect(html).not.toContain("Période reconnue");
    expect(html).not.toContain("bulletin-aout.pdf");
    expect(html).not.toContain("champ rempli");
    expect(html).not.toContain("Ce bulletin porte août 2026");
    expect(html).not.toContain("dimanche en attente pour octobre 2026");
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
    expect(html).toContain("Signaler une anomalie");
    expect(html).not.toContain("Anomalies ou observations");
    expect(html).not.toContain("Enregistrer les anomalies");
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
