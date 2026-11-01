import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BalanceDetailDialog, type BalanceDetailDialogProps } from "./BalanceDetailDialog";

const period = { id: "p1", from: "2026-03-10", to: "2026-03-10", leaveType: "annual" as const, updatedAt: "2026-03-01" };

const props: BalanceDetailDialogProps = {
  balanceDetail: { title: "Congés annuels", quota: true, allowance: 29, manualUsed: 0, remaining: 28, used: 1, details: [{ date: "2026-03-10", units: 1, period }] },
  balanceDetailType: "annual",
  balanceDetailPeriods: [
    { key: "taken", label: "Congés déjà pris", units: 1, details: [{ date: "2026-03-10", units: 1, period }] },
    { key: "upcoming", label: "Congés à venir", units: 0, details: [] },
  ],
  recentBalanceDetailDates: new Set(),
  absenceYear: 2026,
  now: new Date(2026, 9, 31),
  onClose: vi.fn(),
  onOpenDate: vi.fn(),
  onOpenManualAdjustments: vi.fn(),
  strikeEstimateFor: vi.fn(),
};

describe("BalanceDetailDialog", () => {
  it("sépare les congés pris et à venir, chaque rubrique avec son total", () => {
    const html = renderToStaticMarkup(<BalanceDetailDialog {...props} />);
    expect(html).toContain('class="balance-detail-months"');
    expect(html).toMatch(/class="balance-detail-month balance-detail-taken"><summary>[^]*?<strong>Congés déjà pris<\/strong><small>1 jour<\/small>/);
    expect(html).toMatch(/class="balance-detail-month balance-detail-upcoming"><summary>[^]*?<strong>Congés à venir<\/strong><small>0 jour<\/small>/);
    // Une rubrique vide le dit, avec l'année affichée.
    expect(html).toContain("Aucun congé dans cette rubrique en 2026.");
    expect(html).toContain("Déjà pris · voir et gérer cette absence");
  });
});
