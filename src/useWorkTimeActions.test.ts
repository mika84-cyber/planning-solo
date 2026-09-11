import { describe, expect, it } from "vitest";
import type { MecenatEntry } from "./mecenat";
import type { OvertimeEntry, RecoveryUse } from "./overtime";
import {
  mecenatSavePayload,
  overtimeSavePayload,
  recoveryDraftMinutes,
  recoverySavePayload,
  solidarityMinutes,
  validCalendarDate,
} from "./useWorkTimeActions";

describe("useWorkTimeActions — validations et payloads", () => {
  it("refuse les dates calendaires impossibles même lorsqu’elles ont le bon format", () => {
    expect(validCalendarDate("2026-09-09")).toBe(true);
    expect(validCalendarDate("2026-02-31")).toBe(false);
    expect(validCalendarDate("09/09/2026")).toBe(false);
  });

  it("convertit les heures de solidarité et les durées libres sans arrondi fragile", () => {
    expect(solidarityMinutes({ hours: "2,5", minutes: "15", basis: "credited" })).toBe(165);
    expect(recoveryDraftMinutes({
      date: "2026-09-09", kind: "hours", hours: "1,5", minutes: "15",
      start: "", durationMinutes: null, trainingMinutes: 360,
    })).toBe(105);
  });

  it.each([
    ["full", 495], ["three_quarters", 390], ["half", 240],
  ] as const)("enregistre réellement la durée du férié pour la quotité %s", (quota, expected) => {
    expect(recoveryDraftMinutes({
      date: "2026-09-09", kind: "holiday", hours: "8", minutes: "0",
      start: "", durationMinutes: 480, trainingMinutes: 360,
    }, quota)).toBe(expected);
  });

  it("conserve le choix de 6 h ou 3 h pour une formation", () => {
    const draft = {
      date: "2026-09-09", kind: "training" as const, hours: "", minutes: "0",
      start: "", durationMinutes: 360, trainingMinutes: 180 as const,
    };
    expect(recoveryDraftMinutes(draft, "full")).toBe(180);
    expect(recoveryDraftMinutes({ ...draft, trainingMinutes: 360 }, "three_quarters")).toBe(360);
    expect(recoveryDraftMinutes({ ...draft, trainingMinutes: 360 }, "half")).toBe(180);
  });

  it("envoie uniquement les champs serveur attendus pour les heures supplémentaires", () => {
    const entry: OvertimeEntry = {
      id: "overtime-1", date: "2026-09-09", minutes: 180,
      dayMinutes: 120, nightMinutes: 60, disposition: "paid",
      inputMode: "range", start: "20:00", end: "23:00",
      updatedAt: "2026-09-09T23:00:00.000Z",
    };
    expect(overtimeSavePayload(entry)).toEqual({
      action: "save-overtime", id: "overtime-1", date: "2026-09-09",
      minutes: 180, dayMinutes: 120, nightMinutes: 60,
      disposition: "paid", inputMode: "range", start: "20:00", end: "23:00",
    });
    expect(overtimeSavePayload(entry)).not.toHaveProperty("updatedAt");
  });

  it("construit un payload de récupération minimal sans métadonnée locale", () => {
    const entry: RecoveryUse = {
      id: "recovery-1", date: "2026-09-10", minutes: 360,
      kind: "training", start: "09:00", updatedAt: "local-only",
    };
    expect(recoverySavePayload(entry)).toEqual({
      action: "save-recovery-use", id: "recovery-1", date: "2026-09-10",
      minutes: 360, start: "09:00", kind: "training",
    });
  });

  it("laisse le serveur recalculer les montants réglementaires du mécénat", () => {
    const entry: MecenatEntry = {
      id: "mecenat-1", date: "2026-09-11", start: "19:00", end: "23:00",
      dayMinutes: 180, nightMinutes: 60, grossAmountCents: 12_345,
      payYear: 2026, payMonth: 9, updatedAt: "local-only",
    };
    expect(mecenatSavePayload(entry)).toEqual({
      action: "save-mecenat", id: "mecenat-1", date: "2026-09-11",
      start: "19:00", end: "23:00", payYear: 2026, payMonth: 9,
    });
    expect(mecenatSavePayload(entry)).not.toHaveProperty("grossAmountCents");
  });
});

describe("reprise du solde de récupération", () => {
  it("reprend tel quel un solde déjà calculé", () => {
    expect(solidarityMinutes({ hours: "20", minutes: "0", basis: "credited" })).toBe(1200);
  });

  it("majore de 25 % des heures saisies comme travaillées", () => {
    // 20 h travaillées donnent 25 h : 15 minutes gagnées par heure.
    expect(solidarityMinutes({ hours: "20", minutes: "0", basis: "worked" })).toBe(1500);
    expect(solidarityMinutes({ hours: "4", minutes: "0", basis: "worked" })).toBe(300);
    expect(solidarityMinutes({ hours: "3", minutes: "45", basis: "worked" })).toBe(281);
  });
});
