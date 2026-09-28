import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { emptyEntry, personalPresenceForDate } from "./appModel";
import { ColleagueWeekTable, sharedPlanningTomorrowSummary, statusWithPost } from "./ColleaguePlanningPage";
import { PlanningDayCell } from "./PlanningDayCell";
import { dateKey, getDayInfo } from "./planningLogic";
import { canChooseWorkPost } from "./workPost";

// Premier jour travaillé du groupe 2 à partir du 28 septembre 2026.
const workDay = (() => {
  for (let day = 28; ; day++) {
    const date = new Date(2026, 8, day, 12);
    if (getDayInfo(date, 2).kind === "work" && !getDayInfo(date, 2).holiday) return date;
  }
})();
const key = dateKey(workDay);
const counterEntries = { [key]: { ...emptyEntry(), workPost: "counter" as const } };

describe("poste du jour : salle, comptoir ou billetterie", () => {
  it("ne se choisit que sur un jour réellement travaillé", () => {
    const base = { date: key, group: 2, entries: {}, periods: [], recoveryUses: [], closed: false };
    expect(canChooseWorkPost(base)).toBe(true);
    expect(canChooseWorkPost({ ...base, closed: true })).toBe(false);
    expect(canChooseWorkPost({ ...base, periods: [{ from: key, to: key }] })).toBe(false);
    expect(canChooseWorkPost({ ...base, recoveryUses: [{ date: key }] })).toBe(false);
    expect(canChooseWorkPost({ ...base, entries: { [key]: { ...emptyEntry(), exchangeRole: "given" } } })).toBe(false);
  });

  it("accompagne la présence d'une journée travaillée, jamais une absence", () => {
    expect(personalPresenceForDate(workDay, 2, [], counterEntries)).toEqual({ status: "work", workPost: "counter" });
    expect(personalPresenceForDate(workDay, 2, [{ id: "p", from: key, to: key, leaveType: "annual", updatedAt: "" }], counterEntries))
      .toEqual({ status: "absence" });
  });

  it("affiche un petit C rouge dans la case, rien pour la salle", () => {
    const props = {
      date: workDay, group: 2, cleanupSelected: false, today: false, recoveryEntries: [], showLeaves: true, showNotes: true,
      inPendingRange: false, rangeSelecting: false, recoveryRangeSelecting: false, noteSelecting: false, noteColor: "#d3943d", onClick: vi.fn(),
    };
    const counter = renderToStaticMarkup(<PlanningDayCell {...props} entry={counterEntries[key]} />);
    expect(counter).toContain('<span class="work-post-marker" aria-hidden="true">C</span>');
    expect(counter).toContain("comptoir d’accueil");
    expect(renderToStaticMarkup(<PlanningDayCell {...props} entry={emptyEntry()} />)).not.toContain("work-post-marker");
  });

  it("donne E, C ou B dans la semaine partagée et précise le poste dans la liste du jour", () => {
    const planning = { owner: { userId: "a", displayName: "Agnès" }, group: 2, days: [{ date: key, status: "work" as const, workPost: "ticketing" as const }] };
    expect(sharedPlanningTomorrowSummary(planning, workDay)).toMatchObject({ status: "Travail", post: "ticketing" });
    expect(statusWithPost("Travail", "counter")).toBe("Travail · Comptoir d’accueil");
    expect(statusWithPost("Travail", "")).toBe("Travail");
    const html = renderToStaticMarkup(
      <ColleagueWeekTable
        days={[workDay]}
        referenceDate={workDay}
        rows={[
          { id: "a", name: "Agnès", group: 2, isSelf: false, statusFor: () => "Travail", postFor: () => "ticketing" },
          { id: "b", name: "Samir", group: 2, isSelf: false, statusFor: () => "Travail" },
        ]}
      />,
    );
    expect(html).toContain('title="Travail · Billetterie"><span aria-hidden="true">B</span>');
    expect(html).toContain('title="Travail"><span aria-hidden="true">E</span>');
  });
});
