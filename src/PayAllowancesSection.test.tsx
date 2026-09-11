import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayAllowancesSection } from "./PayAllowancesSection";
import { sundayAllowance } from "./planningLogic";

const props = {
  allowances: {
    year: 2026,
    sundayTotal: sundayAllowance(12),
    sundayDone: 12,
    sundayLeft: 3,
    sundayCount: 15,
    sundaysScheduledPast: 13,
    sundays: [
      ...["01-04", "01-25", "02-15", "03-08", "03-29", "04-19", "05-10", "05-31", "06-21", "07-12", "08-02", "08-23"]
        .map((day) => ({ key: `2026-${day}`, past: true })),
      ...["09-13", "10-04", "10-25"].map((day) => ({ key: `2026-${day}`, past: false })),
    ],
    tier: { label: "11 à 15" },
    holidays: [{ key: "2026-07-14", name: "Fête nationale", choice: "prime" as const }],
    cancelledHolidays: [{ key: "2026-05-01", name: "Fête du Travail" }],
    compensated: [{ key: "2026-11-11", name: "Armistice", choice: "" as const }],
    holidayPending: 1,
    monthlyTotal: 420,
  },
  monthPay: {
    sundayCount: 2,
    sunday: 120,
    holidayCount: 1,
    holiday: 90,
    strikeDeductedDays: 2,
    strikeAutomaticDays: 1,
    strikePotentialDays: 0,
  },
  overtimeForPayMonth: { totalMinutes: 120, ready: true, amount: 50 },
  mecenatForPayMonth: { totalMinutes: 90, grossAmountCents: 3500 },
  strikeForPayMonth: { totalDeduction: 80 },
  isContractuel: false,
  baseSalary: 2_000,
  month: 6,
  year: 2026,
  payPeriodOpen: true,
  holidayChoiceEditing: null,
  onTogglePayPeriod: vi.fn(),
  onChangeMonth: vi.fn(),
  onGoToday: vi.fn(),
  onEditHolidayChoice: vi.fn(),
  onChooseHolidayPay: vi.fn(),
};

describe("PayAllowancesSection", () => {
  it("rend le mois, toutes les primes variables et les fériés sans changer les libellés", () => {
    const html = renderToStaticMarkup(<PayAllowancesSection {...props} />);

    expect(html).toContain("Primes pour le mois");
    expect(html).toContain("juillet 2026");
    expect(html).toContain("Heures supplémentaires payées");
    expect(html).toContain("Mécénats");
    expect(html).toContain("dont 1 repos noir");
    expect(html).toContain("Mes primes en un coup d’œil");
    expect(html).toContain("12 dimanches effectués sur 13 à ce jour");
    expect(html).toContain("Fête nationale");
    expect(html).toContain("Fête du Travail");
    expect(html).toContain("Fériés compensés 2026");
    expect(html).toContain("paie de février 2027");
  });

  it("accorde correctement le libellé d’un seul dimanche", () => {
    const html = renderToStaticMarkup(
      <PayAllowancesSection
        {...props}
        allowances={{ ...props.allowances, sundayDone: 1, sundaysScheduledPast: 1 }}
      />,
    );
    expect(html).toContain("1 dimanche effectué sur 1 à ce jour");
  });

  it("masque le détail mensuel tout en conservant les commandes de navigation", () => {
    const html = renderToStaticMarkup(
      <PayAllowancesSection {...props} payPeriodOpen={false} />,
    );

    expect(html).toContain("Ouvrir pour les détails");
    expect(html).toContain("Mois précédent");
    expect(html).toContain("Mois suivant");
    expect(html).not.toContain("Heures supplémentaires payées");
  });
});

describe("la liste des dimanches faits", () => {
  it("reste repliée au premier affichage : la carte garde son résumé", () => {
    const html = renderToStaticMarkup(<PayAllowancesSection {...props} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Dimanche 23/08");
  });

  it("dit qu'on peut ouvrir, sur la case des dimanches travaillés", () => {
    const html = renderToStaticMarkup(<PayAllowancesSection {...props} />);
    // La case du résumé est un vrai bouton, et elle annonce ce qu'il y a
    // dessous : sans cette mention, rien n'indique qu'elle s'ouvre.
    expect(html).toContain(
      'class="allowance-overview-toggle" aria-expanded="false" aria-controls="sunday-done-list"><span>Dimanches travaillés</span>',
    );
    expect(html).toContain("Voir les dates");
    expect(html).not.toContain("Masquer les dates");
  });
});
