import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { annualCharges } from "./annualCarryOver";
import { computeLeaveStats } from "./leaveStats";
import { TimeSelectionDialog } from "./PlanningDialogs";
import { dateKey, getDayInfo, halfBalanceOf, periodTypeLabel } from "./planningLogic";

// Premier jour travaillé du groupe 2 à partir du 1er octobre 2027.
const workDay = (() => {
  for (let day = 1; ; day++) {
    const date = new Date(2027, 9, day, 12);
    if (getDayInfo(date, 2).kind === "work" && !getDayInfo(date, 2).holiday) return dateKey(date);
  }
})();
const half = (halfBalance?: "exceptional" | "other") => ({
  id: `half-${halfBalance ?? "ca"}`, from: workDay, to: workDay, leaveType: "half" as const, halfMoment: "morning" as const, halfBalance, group: 2, updatedAt: "",
});

describe("ASA et Divers en demi-journée", () => {
  it("se lisent comme des demi-journées prises sur l’ASA ou sur Divers", () => {
    expect(halfBalanceOf({ halfBalance: "exceptional" })).toBe("exceptional");
    expect(halfBalanceOf({ halfBalance: "other" })).toBe("other");
    expect(periodTypeLabel(half("exceptional"))).toBe("Jour exceptionnel en demi-journée");
    expect(periodTypeLabel(half("other"))).toBe("Divers en demi-journée");
  });

  it("comptent 0,5 dans leur suivi, jamais sur les congés annuels", () => {
    const stats = computeLeaveStats({ year: 2027, today: new Date(2027, 0, 1), periods: [half("exceptional"), { ...half("other"), id: "divers" }] as never, group: 2, manualAdjustments: undefined });
    expect(stats.countedOnly.exceptional.used).toBe(0.5);
    expect(stats.countedOnly.other.used).toBe(0.5);
    expect(stats.balances.find((balance) => balance.type === "annual")?.used).toBe(0);
    expect(annualCharges([half("exceptional"), half("other")], () => 25).charges).toEqual([]);
    expect(annualCharges([half()], () => 25).charges).toHaveLength(1);
  });

  it("proposent journée entière, matin ou après-midi, sans sous-titres", () => {
    const html = renderToStaticMarkup(
      <TimeSelectionDialog date={workDay} activeType="exceptional" start="" end="" onStartChange={vi.fn()} onEndChange={vi.fn()} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(html).toContain("Journée ou demi-journée ?");
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true" class="active"><span class="half-day-icon" aria-hidden="true">●<\/span><strong>Journée entière/);
    expect(html).toContain("Le matin");
    expect(html).toContain("L’après-midi");
    expect(html).not.toContain("<small>");
    expect(html).not.toContain("Prise sur");
  });
});
