import { describe, expect, it } from "vitest";
import { parseDemoCompletedRequestJson } from "./demoCompletedRequest";

describe("parseDemoCompletedRequestJson", () => {
  it("normalise une demande de récupération sans laisser passer les rubriques étrangères", () => {
    const request = parseDemoCompletedRequestJson(JSON.stringify({
      requestId: "request-recovery-1",
      requestKind: "recovery",
      group: "2",
      profile: { workQuota: "three_quarters" },
      periods: [
        { type: "recovery_day", from: "2026-09-02", to: "2026-09-03" },
        { type: "annual", from: "2026-09-04" },
      ],
      timed: [
        { type: "recovery_training", date: "2026-09-05", start: "09:00", end: "15:00" },
        { type: "half", date: "2026-09-06", start: "09:00" },
      ],
    }));

    expect(request).toMatchObject({
      requestId: "request-recovery-1",
      requestKind: "recovery",
      group: 2,
      profile: { workQuota: "three_quarters" },
    });
    if (!request || request.requestKind !== "recovery") throw new Error("Demande attendue");
    expect(request.periods).toEqual([
      { type: "recovery_day", from: "2026-09-02", to: "2026-09-03" },
    ]);
    expect(request.timed).toEqual([
      { type: "recovery_training", date: "2026-09-05", start: "09:00", end: "15:00" },
    ]);
  });

  it("valide une absence locale et ignore les lignes mal formées", () => {
    const request = parseDemoCompletedRequestJson(JSON.stringify({
      requestId: "request-leave-1",
      requestKind: "leave",
      group: 1,
      periods: [
        { type: "sick", from: "2026-10-01" },
        { type: "annual", from: "incorrecte" },
        { type: "rtt", from: "2026-99-99" },
      ],
      timed: [{ type: "half", date: "2026-10-02", start: "13:30" }],
    }));

    expect(request).toMatchObject({
      requestKind: "leave",
      profile: { workQuota: "full" },
      periods: [{ type: "sick", from: "2026-10-01", to: "2026-10-01" }],
      timed: [{ type: "half", date: "2026-10-02", start: "13:30", end: "" }],
    });
  });

  it("refuse un JSON ou une entête de transfert invalides", () => {
    expect(parseDemoCompletedRequestJson("{")).toBeNull();
    expect(parseDemoCompletedRequestJson(JSON.stringify({
      requestId: "request",
      requestKind: "leave",
      group: 9,
    }))).toBeNull();
  });
});
