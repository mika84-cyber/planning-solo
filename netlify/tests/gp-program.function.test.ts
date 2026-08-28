import { beforeEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, unknown>();
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  setJSON: vi.fn(async (key: string, value: unknown) => { data.set(key, value); }),
};

vi.mock("@netlify/identity", () => ({ getUser: vi.fn() }));
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));

import { getUser } from "@netlify/identity";
import grandPalaisProgramHandler from "../functions/gp-program.mts";

const mockedGetUser = vi.mocked(getUser);
const proposal = {
  id: "proposal-1",
  kind: "new" as const,
  detectedAt: "2026-08-28T06:00:00.000Z",
  next: {
    id: "event-1",
    title: "Exposition test",
    startDate: "2027-01-10",
    endDate: "2027-04-10",
    url: "https://www.grandpalais.fr/fr/programme/exposition-test",
    venueKey: "gallery8",
    venueLabel: "Galerie 8",
  },
};

describe("API partagée de la programmation GP", () => {
  beforeEach(() => {
    data.clear();
    store.get.mockClear();
    store.setJSON.mockClear();
    mockedGetUser.mockReset();
    data.set("pending", [proposal]);
    (globalThis as typeof globalThis & { Netlify?: unknown }).Netlify = {
      env: { get: (name: string) => name === "PROGRAM_ADMIN_EMAIL" ? "admin@example.test" : undefined },
    };
  });

  it("ne révèle aucune proposition à un compte invité", async () => {
    mockedGetUser.mockResolvedValue({ id: "guest", email: "guest@example.test" } as never);
    const response = await grandPalaisProgramHandler(new Request("https://example.test/api/gp-program"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isAdmin: false, pending: [] });
  });

  it("réserve les décisions au compte administrateur", async () => {
    mockedGetUser.mockResolvedValue({ id: "guest", email: "guest@example.test" } as never);
    const response = await grandPalaisProgramHandler(new Request("https://example.test/api/gp-program", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: proposal.id, decision: "accept" }),
    }));
    expect(response.status).toBe(403);
  });

  it("rend une exposition acceptée visible dans les données partagées", async () => {
    mockedGetUser.mockResolvedValue({ id: "owner", email: "ADMIN@example.test" } as never);
    const response = await grandPalaisProgramHandler(new Request("https://example.test/api/gp-program", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: proposal.id, decision: "accept" }),
    }));
    const payload = await response.json() as { approved: Array<{ title: string }>; pending: unknown[] };
    expect(response.status).toBe(200);
    expect(payload.approved[0].title).toBe("Exposition test");
    expect(payload.pending).toEqual([]);
  });
});
