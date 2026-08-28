import { beforeEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, unknown>();
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  setJSON: vi.fn(async (key: string, value: unknown, options?: { onlyIfNew?: boolean }) => {
    if (options?.onlyIfNew && data.has(key)) return { modified: false };
    data.set(key, value);
    return { modified: true };
  }),
  delete: vi.fn(async (key: string) => { data.delete(key); }),
  list: vi.fn(({ prefix }: { prefix: string }) => ({
    async *[Symbol.asyncIterator]() {
      yield {
        blobs: [...data.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
      };
    },
  })),
};

vi.mock("@netlify/identity", () => ({ getUser: vi.fn() }));
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));

import { getUser } from "@netlify/identity";
import calendarHandler from "../functions/calendar.mts";

const mockedGetUser = vi.mocked(getUser);
const request = (body: unknown, headers: Record<string, string> = {}) => new Request(
  "https://example.test/api/calendar",
  {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  },
);

describe("API principale du calendrier", () => {
  beforeEach(() => {
    data.clear();
    store.get.mockClear();
    store.setJSON.mockClear();
    store.delete.mockClear();
    store.list.mockClear();
    mockedGetUser.mockReset();
  });

  it("refuse toute lecture sans authentification", async () => {
    mockedGetUser.mockResolvedValue(null);
    const response = await calendarHandler(new Request("https://example.test/api/calendar"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Connexion requise" });
  });

  it("refuse une écriture demandée par un autre site", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(new Request("https://example.test/api/calendar", {
      method: "POST",
      headers: { origin: "https://attacker.test", "content-type": "application/json" },
      body: JSON.stringify({ action: "save-entry", date: "2026-08-28" }),
    }));
    expect(response.status).toBe(403);
    expect(store.setJSON).not.toHaveBeenCalled();
  });

  it("ne renvoie que les données du compte connecté", async () => {
    data.set("user/user-a/entry/2026-08-28", {
      date: "2026-08-28",
      note_text: "Privé A",
      updated_at: "2026-08-28T10:00:00.000Z",
    });
    data.set("user/user-b/entry/2026-08-29", {
      date: "2026-08-29",
      note_text: "Privé B",
      updated_at: "2026-08-28T11:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(new Request("https://example.test/api/calendar"));
    const payload = await response.json() as { entries: Array<{ note_text: string }> };
    expect(response.status).toBe(200);
    expect(payload.entries.map((entry) => entry.note_text)).toEqual(["Privé A"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("écrit une note uniquement sous le préfixe du compte", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-entry",
      date: "2026-08-28",
      noteText: "Une note privée",
      noteColor: "#D3943D",
    }));
    expect(response.status).toBe(200);
    expect(data.get("user/user-a/entry/2026-08-28")).toMatchObject({
      date: "2026-08-28",
      note_text: "Une note privée",
    });
    expect([...data.keys()].some((key) => key === "entry/2026-08-28")).toBe(false);
  });

  it("détecte une modification concurrente", async () => {
    data.set("user/user-a/entry/2026-08-28", {
      date: "2026-08-28",
      note_text: "Version récente",
      updated_at: "2026-08-28T12:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-entry",
      date: "2026-08-28",
      noteText: "Ancienne modification",
      expectedUpdatedAt: "2026-08-28T11:00:00.000Z",
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Cette journée a été modifiée sur un autre appareil",
    });
  });

  it("refuse une requête annoncée au-delà de la limite", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request(
      { action: "save-entry" },
      { "content-length": "5000001" },
    ));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Requête trop volumineuse" });
  });
});
