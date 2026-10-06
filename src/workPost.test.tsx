import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { emptyEntry, personalPresenceForDate } from "./appModel";
import { ColleagueWeekTable, dayStatusLabel, sharedPlanningTomorrowSummary, statusWithPost } from "./ColleaguePlanningPage";
import { PlanningDayCell } from "./PlanningDayCell";
import { dateKey, getDayInfo } from "./planningLogic";
import type { Entries } from "./appModel";
import { canChooseWorkPost, saveWorkPostOptimistically } from "./workPost";

// Premier jour travaillé du groupe 2 à partir du 28 septembre 2026.
const workDay = (() => {
  for (let day = 28; ; day++) {
    const date = new Date(2026, 8, day, 12);
    if (getDayInfo(date, 2).kind === "work" && !getDayInfo(date, 2).holiday) return date;
  }
})();
const key = dateKey(workDay);
const counterEntries = { [key]: { ...emptyEntry(), workPost: "counter" as const } };

describe("poste du jour : salle, accueil ou billetterie", () => {
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
    // Une demi-journée garde le poste de sa moitié travaillée.
    expect(personalPresenceForDate(workDay, 2, [{ id: "h", from: key, to: key, leaveType: "half", halfMoment: "morning", updatedAt: "" }], counterEntries))
      .toMatchObject({ status: "partial", halfMoment: "morning", workPost: "counter" });
  });

  it("affiche un petit A rouge dans la case, rien pour la salle", () => {
    const props = {
      date: workDay, group: 2, cleanupSelected: false, today: false, recoveryEntries: [], showLeaves: true, showNotes: true,
      inPendingRange: false, rangeSelecting: false, recoveryRangeSelecting: false, noteSelecting: false, noteColor: "#d3943d", onClick: vi.fn(),
    };
    const counter = renderToStaticMarkup(<PlanningDayCell {...props} entry={counterEntries[key]} />);
    expect(counter).toContain('<span class="work-post-marker" aria-hidden="true">A</span>');
    expect(counter).toContain(", accueil");
    expect(renderToStaticMarkup(<PlanningDayCell {...props} entry={emptyEntry()} />)).not.toContain("work-post-marker");
  });

  it("donne EX, AC ou BI dans la semaine partagée et précise le poste dans la liste du jour", () => {
    const planning = { owner: { userId: "a", displayName: "Agnès" }, group: 2, days: [{ date: key, status: "work" as const, workPost: "ticketing" as const }] };
    expect(sharedPlanningTomorrowSummary(planning, workDay)).toMatchObject({ status: "Travail", post: "ticketing" });
    expect(statusWithPost("Travail", "counter")).toBe("Travail · Accueil");
    expect(statusWithPost("Travail", "")).toBe("Travail");
    // Vue jour : le lieu de travail en clair.
    expect(["", "counter", "ticketing"].map((post) => dayStatusLabel("Travail", post as "" | "counter" | "ticketing"))).toEqual(["En salles", "Accueil", "Billetterie"]);
    expect(dayStatusLabel("Repos", "counter")).toBe("Repos");
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
    expect(html).toContain('title="Travail · Billetterie"><span aria-hidden="true">BI</span>');
    expect(html).toContain('title="Travail"><span aria-hidden="true">EX</span>');
  });

  it("affiche le poste tout de suite, puis garde la version du serveur sans tout relire", async () => {
    let state: Entries = { [key]: { ...emptyEntry(), noteText: "Relais", updatedAt: "v1" } };
    const setEntries = (update: Entries | ((all: Entries) => Entries)) => { state = typeof update === "function" ? update(state) : update; };
    let seenWhileSaving: Entries = {};
    const post = vi.fn(async () => { seenWhileSaving = state; return { updatedAt: "v2" }; });
    const reload = vi.fn(async () => undefined);
    const closeDay = vi.fn();
    await saveWorkPostOptimistically({ date: key, workPost: "ticketing", entries: state, setEntries, closeDay, demoMode: false, post, notify: vi.fn(), reload });
    // La lettre est déjà là pendant l'envoi, et la fiche est refermée.
    expect(seenWhileSaving[key]?.workPost).toBe("ticketing");
    expect(closeDay).toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ action: "save-entry", date: key, workPost: "ticketing", noteText: "Relais", expectedUpdatedAt: "v1" }));
    expect(state[key]).toMatchObject({ workPost: "ticketing", updatedAt: "v2" });
    expect(reload).not.toHaveBeenCalled();
  });

  it("revient en arrière et prévient si l'enregistrement échoue", async () => {
    let state: Entries = {};
    const setEntries = (update: Entries | ((all: Entries) => Entries)) => { state = typeof update === "function" ? update(state) : update; };
    const notify = vi.fn();
    const reload = vi.fn(async () => undefined);
    await saveWorkPostOptimistically({
      date: key, workPost: "counter", entries: state, setEntries, closeDay: vi.fn(), demoMode: false,
      post: async () => { throw new Error("réseau"); }, notify, reload,
    });
    expect(state[key]).toBeUndefined();
    expect(notify).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});
