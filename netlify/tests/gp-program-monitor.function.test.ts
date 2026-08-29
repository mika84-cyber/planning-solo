import { beforeEach, describe, expect, it, vi } from "vitest";

const stored = new Map<string, unknown>();
const store = {
  get: vi.fn(async (key: string) => stored.get(key) ?? null),
  setJSON: vi.fn(async (key: string, value: unknown) => { stored.set(key, value); }),
};

vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));
vi.mock("../lib/grandPalaisMonitor.mts", () => ({
  collectGrandPalaisEvents: vi.fn(),
  detectGrandPalaisChanges: vi.fn(),
  sendGrandPalaisAlertEmail: vi.fn(),
}));

import {
  collectGrandPalaisEvents,
  detectGrandPalaisChanges,
  sendGrandPalaisAlertEmail,
} from "../lib/grandPalaisMonitor.mts";
import monitorGrandPalaisProgram, {
  config,
} from "../functions/gp-program-monitor.mts";

const mockedCollect = vi.mocked(collectGrandPalaisEvents);
const mockedDetect = vi.mocked(detectGrandPalaisChanges);
const mockedSendAlert = vi.mocked(sendGrandPalaisAlertEmail);

const event = {
  id: "event-1",
  title: "Exposition test",
  startDate: "2027-01-10",
  endDate: "2027-04-10",
  url: "https://www.grandpalais.fr/fr/programme/exposition-test",
  venueKey: "gallery8",
  venueLabel: "Galerie 8",
};
const proposal = {
  id: "proposal-1",
  kind: "new" as const,
  detectedAt: "2026-08-29T06:00:00.000Z",
  next: event,
};
const nextState = {
  lastCheckedAt: "2026-08-29T06:00:00.000Z",
  events: [event],
};

describe("surveillance planifiée du programme Grand Palais", () => {
  beforeEach(() => {
    stored.clear();
    store.get.mockClear();
    store.setJSON.mockClear();
    mockedCollect.mockReset();
    mockedDetect.mockReset();
    mockedSendAlert.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("collecte, conserve et signale les nouvelles propositions chaque jour", async () => {
    stored.set("monitor-state", { lastCheckedAt: "2026-08-28T06:00:00.000Z", events: [] });
    stored.set("pending", []);
    mockedCollect.mockResolvedValue([event] as never);
    mockedDetect.mockReturnValue({ state: nextState, proposals: [proposal] } as never);
    mockedSendAlert.mockResolvedValue(undefined);

    const response = await monitorGrandPalaisProgram();

    expect(config).toEqual({ schedule: "@daily" });
    expect(store.get).toHaveBeenCalledWith("monitor-state", { type: "json" });
    expect(store.get).toHaveBeenCalledWith("pending", { type: "json" });
    expect(stored.get("monitor-state")).toEqual(nextState);
    expect(stored.get("pending")).toEqual([proposal]);
    expect(mockedSendAlert).toHaveBeenCalledWith([proposal]);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      ok: true,
      checked: 1,
      detected: 1,
      alertSent: true,
      alertWarning: "",
      checkedAt: nextState.lastCheckedAt,
    });
  });

  it("ne duplique pas une proposition déjà en attente", async () => {
    stored.set("pending", [proposal]);
    mockedCollect.mockResolvedValue([event] as never);
    mockedDetect.mockReturnValue({ state: nextState, proposals: [proposal] } as never);

    const response = await monitorGrandPalaisProgram();

    expect(mockedSendAlert).not.toHaveBeenCalled();
    expect(store.setJSON).toHaveBeenCalledTimes(1);
    expect(store.setJSON).toHaveBeenCalledWith("monitor-state", nextState);
    expect(await response.json()).toMatchObject({ detected: 0, alertSent: false });
  });

  it("conserve les propositions si l'e-mail d'alerte est indisponible", async () => {
    mockedCollect.mockResolvedValue([event] as never);
    mockedDetect.mockReturnValue({ state: nextState, proposals: [proposal] } as never);
    mockedSendAlert.mockRejectedValue(new Error("Resend indisponible"));

    const response = await monitorGrandPalaisProgram();

    expect(stored.get("pending")).toEqual([proposal]);
    expect(await response.json()).toMatchObject({
      ok: true,
      detected: 1,
      alertSent: false,
      alertWarning: "Resend indisponible",
    });
    expect(console.warn).toHaveBeenCalled();
  });

  it("normalise aussi une erreur d'alerte non standard", async () => {
    mockedCollect.mockResolvedValue([event] as never);
    mockedDetect.mockReturnValue({ state: nextState, proposals: [proposal] } as never);
    mockedSendAlert.mockRejectedValue("hors ligne");

    const response = await monitorGrandPalaisProgram();
    expect(await response.json()).toMatchObject({
      alertSent: false,
      alertWarning: "Alerte e-mail indisponible",
    });
  });

  it("ne remplace pas l'état si la collecte distante échoue", async () => {
    mockedCollect.mockRejectedValue(new Error("Site distant indisponible"));
    await expect(monitorGrandPalaisProgram()).rejects.toThrow("Site distant indisponible");
    expect(mockedDetect).not.toHaveBeenCalled();
    expect(store.setJSON).not.toHaveBeenCalled();
  });
});
