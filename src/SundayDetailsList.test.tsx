import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SundayDetailsList } from "./SundayDetailsList";
import { sundayAllowance } from "./planningLogic";

const allowances = {
  year: 2026,
  sundayTotal: sundayAllowance(15),
  sundayDone: 12,
  sundayLeft: 3,
  sundayCount: 15,
  sundaysScheduledPast: 13,
  sundays: [
    ...["01-04", "01-25", "02-15", "03-08", "03-29", "04-19", "05-10", "05-31", "06-21", "07-12", "08-02", "08-23", "09-13"]
      .map((day) => ({ key: `2026-${day}`, past: true })),
    ...["10-04", "10-25"].map((day) => ({ key: `2026-${day}`, past: false })),
  ],
  tier: { label: "11 à 15" },
  holidays: [],
  cancelledHolidays: [],
  compensated: [],
  holidayPending: 0,
  monthlyTotal: 0,
};

describe("détail des dimanches", () => {
  it("répartit les dimanches payés par paie, d'après leur rang", () => {
    const html = renderToStaticMarkup(<SundayDetailsList allowances={allowances} onClose={vi.fn()} />);
    expect(html).toContain("Tous compris dans le forfait mensuel");
    expect(html).toContain("3 payés sur cette paie");
    expect(html).not.toContain("reporté");
  });

  it("suit le report d'un dimanche manqué d'une paie primée à la suivante", () => {
    const monthly = [
      { index: 9, carryover: 0, reported: 1, reportedTo: { year: 2026, month: 11 } },
      { index: 11, carryover: 1, reported: 0, carriedFrom: { year: 2026, month: 9 } },
    ];
    const html = renderToStaticMarkup(<SundayDetailsList allowances={{ ...allowances, monthly }} onClose={vi.fn()} />);
    // Octobre : trois dimanches payables, le dernier part sur décembre.
    expect(html).toMatch(/2 payés sur cette paie[^<]* · 1 reporté sur décembre/);
    expect(html).toContain('class="sunday-day paid carried"');
    expect(html).toContain("reporté sur décembre 2026");
    // Décembre : ses deux dimanches, plus celui d'octobre.
    expect(html).toMatch(/3 payés sur cette paie[^<]* · dont 1 reporté d’octobre/);
    expect(html).toContain('<span class="carried">Reporté</span>');
  });
});
