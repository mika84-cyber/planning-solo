import { describe, expect, it } from "vitest";
import { durationLeaveDay, seedAlone, validLeaveHours } from "./useRequestTypeSelection";

describe("durée d’une date de congé", () => {
  it("pose un congé annuel le matin ou l’après-midi, aux heures choisies", () => {
    expect(durationLeaveDay("2026-11-03", "annual", "morning", { start: "08:30", end: "12:00" }))
      .toEqual({ date: "2026-11-03", type: "half", start: "08:30", end: "12:00" });
    expect(durationLeaveDay("2026-11-03", "annual", "afternoon", { start: "14:00", end: "17:30" }))
      .toEqual({ date: "2026-11-03", type: "half", start: "14:00", end: "17:30" });
    expect(durationLeaveDay("2026-11-03", "annual", "full", { start: "08:30", end: "12:00" }))
      .toEqual({ date: "2026-11-03", type: "annual" });
  });

  it("garde le moment seul tant que les heures ne sont pas utilisables", () => {
    expect(durationLeaveDay("2026-11-03", "annual", "afternoon", { start: "", end: "" }))
      .toEqual({ date: "2026-11-03", type: "half", halfMoment: "afternoon" });
    expect(durationLeaveDay("2026-11-03", "annual", "morning", { start: "12:00", end: "09:00" }))
      .toEqual({ date: "2026-11-03", type: "half", halfMoment: "morning" });
    expect(validLeaveHours({ start: "09:00", end: "09:00" })).toBe(false);
  });

  it("ne change la date de départ que tant qu’elle est seule", () => {
    expect(seedAlone({}, "2026-11-03")).toBe(true);
    expect(seedAlone({ "2026-11-03": { date: "2026-11-03", type: "rtt" } }, "2026-11-03")).toBe(true);
    expect(seedAlone({ "2026-11-03": { date: "2026-11-03", type: "rtt" }, "2026-11-04": { date: "2026-11-04", type: "rtt" } }, "2026-11-03")).toBe(false);
  });

  it("pose les RTT et le fractionnement en journée entière, quelle que soit la durée", () => {
    expect(durationLeaveDay("2026-11-03", "rtt", "morning", { start: "08:30", end: "12:00" }))
      .toEqual({ date: "2026-11-03", type: "rtt" });
    expect(durationLeaveDay("2026-11-03", "fraction", "afternoon", { start: "", end: "" }))
      .toEqual({ date: "2026-11-03", type: "fraction" });
  });
});
