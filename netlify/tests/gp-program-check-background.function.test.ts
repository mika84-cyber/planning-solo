import { beforeEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, unknown>();
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  setJSON: vi.fn(async (key: string, value: unknown) => { data.set(key, value); }),
  delete: vi.fn(async (key: string) => { data.delete(key); }),
};
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));
vi.mock("../lib/grandPalaisCheck.mts", () => ({
  CHECK_REQUEST_KEY: "check-request",
  runGrandPalaisCheck: vi.fn(async () => ({ ok: true })),
}));

import { runGrandPalaisCheck } from "../lib/grandPalaisCheck.mts";
import checkGrandPalaisProgramNow from "../functions/gp-program-check-background.mts";

const mockedRun = vi.mocked(runGrandPalaisCheck);

describe("contrôle du Grand Palais lancé à la main", () => {
  beforeEach(() => {
    data.clear();
    mockedRun.mockClear();
  });

  it("ne fait rien sans demande récente de l’administrateur", async () => {
    await checkGrandPalaisProgramNow();
    data.set("check-request", { at: new Date(Date.now() - 10 * 60_000).toISOString() });
    await checkGrandPalaisProgramNow();
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("contrôle le site une seule fois par demande", async () => {
    data.set("check-request", { at: new Date().toISOString() });
    await checkGrandPalaisProgramNow();
    await checkGrandPalaisProgramNow();
    expect(mockedRun).toHaveBeenCalledTimes(1);
    expect(data.has("check-request")).toBe(false);
  });
});
