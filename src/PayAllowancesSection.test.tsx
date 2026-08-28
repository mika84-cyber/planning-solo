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
    expect(html).toContain("Fête nationale");
    expect(html).toContain("Fête du Travail");
    expect(html).toContain("Fériés compensés 2026");
    expect(html).toContain("paie de février 2027");
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
