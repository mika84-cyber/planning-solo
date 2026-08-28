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
import { CALENDAR_ACTIONS } from "../lib/calendar-actions/index.mts";

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

  it("expose explicitement toutes les actions prises en charge", () => {
    expect(CALENDAR_ACTIONS).toEqual([
      "save-request",
      "save-periods",
      "batch",
      "restore-backup",
      "delete-user-data",
      "archive-legacy-data",
      "save-form-profile",
      "save-mecenat",
      "delete-mecenat",
      "save-overtime",
      "delete-overtime",
      "save-recovery-use",
      "delete-recovery-use",
      "save-period",
      "delete-period",
      "clear-legacy-period",
      "save-note-period",
      "delete-note-period",
      "save-leaves",
      "save-entry",
    ]);
  });

  it("refuse une action inconnue sans toucher au stockage", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({ action: "action-inconnue" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Action inconnue" });
    expect([...data.keys()]).toEqual([
      "user/user-a/migration/legacy-import-v1",
    ]);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("achemine une période vers son gestionnaire isolé", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-period",
      id: "period-2026-08-28",
      from: "2026-08-28",
      to: "2026-08-29",
      leaveType: "annual",
      group: 2,
    }));
    expect(response.status).toBe(200);
    expect(data.get("user/user-a/period/period-2026-08-28")).toMatchObject({
      from: "2026-08-28",
      to: "2026-08-29",
      leave_type: "annual",
      group: 2,
    });
  });

  it("conserve les parcours CRUD après la séparation des gestionnaires", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const post = async (body: Record<string, unknown>) => {
      const response = await calendarHandler(request(body));
      expect(response.status, `${body.action} doit réussir`).toBe(200);
      return response.json();
    };

    await post({
      action: "save-form-profile",
      fullName: "Compte A",
      group: "2",
      status: "contractuel",
      workQuota: "full",
      signature: "",
    });
    await post({
      action: "save-overtime",
      id: "overtime-20260828",
      date: "2026-08-28",
      minutes: 120,
      dayMinutes: 120,
      nightMinutes: 0,
      disposition: "recovery",
      inputMode: "duration",
    });
    await post({
      action: "save-recovery-use",
      id: "recovery-20260829",
      date: "2026-08-29",
      minutes: 60,
    });
    await post({
      action: "save-mecenat",
      id: "mecenat-20260830",
      date: "2026-08-30",
      start: "19:00",
      end: "22:00",
    });
    const note = await post({
      action: "save-note-period",
      groupId: "note-group-2026",
      from: "2026-08-28",
      to: "2026-08-29",
      noteText: "Préparation",
      noteColor: "#7358d8",
    }) as { groupId: string };
    expect(note.groupId).toBe("note-group-2026");
    await post({
      action: "save-leaves",
      date: "2026-08-28",
      leave: true,
    });
    await post({
      action: "save-periods",
      periods: [{
        id: "bulk-period-2026",
        from: "2026-09-01",
        to: "2026-09-02",
        leaveType: "rtt",
        group: 2,
      }],
    });
    await post({
      action: "batch",
      operations: [
        {
          action: "save-entry",
          date: "2026-09-03",
          noteText: "Lot",
          noteColor: "#D3943D",
        },
        { action: "save-leaves", date: "2026-09-04", wish: true },
      ],
    });

    expect(data.get("user/user-a/form-profile")).toMatchObject({ group: "2" });
    expect(data.get("user/user-a/recovery-use/recovery-20260829")).toMatchObject({ minutes: 60 });
    expect(data.get("user/user-a/mecenat/mecenat-20260830")).toBeTruthy();
    expect(data.get("user/user-a/entry/2026-09-03")).toMatchObject({ note_text: "Lot" });

    await post({ action: "delete-note-period", groupId: "note-group-2026" });
    await post({ action: "clear-legacy-period", from: "2026-08-28", to: "2026-08-29" });
    await post({ action: "delete-period", id: "bulk-period-2026" });
    await post({ action: "delete-recovery-use", id: "recovery-20260829" });
    await post({ action: "delete-overtime", id: "overtime-20260828" });
    await post({ action: "delete-mecenat", id: "mecenat-20260830" });

    expect(data.has("user/user-a/period/bulk-period-2026")).toBe(false);
    expect(data.has("user/user-a/overtime/overtime-20260828")).toBe(false);
    expect(data.has("user/user-a/mecenat/mecenat-20260830")).toBe(false);
  });

  it("préserve les validations des actions sensibles extraites", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    for (const body of [
      { action: "save-request" },
      { action: "restore-backup", backup: null },
      { action: "delete-user-data", confirmation: "NON" },
      { action: "archive-legacy-data", confirmation: "NON" },
    ]) {
      const response = await calendarHandler(request(body));
      expect(response.status, `${body.action} doit être refusée`).toBe(400);
      expect(await response.json()).toHaveProperty("error");
    }
  });

  it("restaure une sauvegarde vide puis efface uniquement le compte courant", async () => {
    data.set("user/user-b/entry/2026-08-30", { date: "2026-08-30" });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const restore = await calendarHandler(request({
      action: "restore-backup",
      backup: {
        version: 1,
        entries: [],
        periods: [],
        overtime_entries: [],
        recovery_uses: [],
        mecenat_entries: [],
        form_profile: null,
      },
    }));
    expect(restore.status).toBe(200);

    const remove = await calendarHandler(request({
      action: "delete-user-data",
      confirmation: "SUPPRIMER",
    }));
    expect(remove.status).toBe(200);
    expect([...data.keys()].some((key) => key.startsWith("user/user-a/"))).toBe(false);
    expect(data.has("user/user-b/entry/2026-08-30")).toBe(true);
  });
});
