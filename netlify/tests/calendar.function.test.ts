import { beforeEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, unknown>();
const etagFor = (key: string) => data.has(key) ? `etag:${JSON.stringify(data.get(key))}` : "";
const setStoredJson = async (
  key: string,
  value: unknown,
  options?: { onlyIfNew?: boolean; onlyIfMatch?: string },
) => {
  if (options?.onlyIfNew && data.has(key)) return { modified: false };
  if (options?.onlyIfMatch && options.onlyIfMatch !== etagFor(key)) return { modified: false };
  data.set(key, value);
  return { modified: true, etag: etagFor(key) };
};
const getStoredWithMetadata = async (key: string) => data.has(key) ? { data: data.get(key), etag: etagFor(key), metadata: {} } : null;
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  getWithMetadata: vi.fn(getStoredWithMetadata),
  setJSON: vi.fn(setStoredJson),
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
    store.getWithMetadata.mockReset();
    store.getWithMetadata.mockImplementation(getStoredWithMetadata);
    store.setJSON.mockReset();
    store.setJSON.mockImplementation(setStoredJson);
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

  it("enregistre le crédit férié de 4 h d’un mi-temps", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-entry",
      date: "2026-09-10",
      holidayPay: "recovery",
      holidayRecoveryMinutes: 240,
    }));
    expect(response.status).toBe(200);
    expect(data.get("user/user-a/entry/2026-09-10")).toMatchObject({
      holiday_pay: "recovery",
      holiday_recovery_minutes: 240,
    });
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
      "delete-shared-partner-note",
      "save-leaves",
      "save-entry",
      "save-exchange",
      "delete-exchange",
    ]);
  });

  it("réserve la suppression d’une note partenaire au partage privé", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "delete-shared-partner-note",
      date: "2026-09-04",
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Partage privé indisponible" });
  });

  it("enregistre, préserve puis supprime toujours les deux dates d’un échange", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const save = await calendarHandler(request({
      action: "save-exchange",
      id: "exchange-2026-a",
      partnerName: "Camille",
      partnerGroup: 1,
      agreementDate: "2026-09-08",
      returnDate: "2026-09-01",
      expectedUpdatedAts: { "2026-09-01": "", "2026-09-08": "" },
    }));
    expect(save.status).toBe(200);
    expect(data.get("user/user-a/entry/2026-09-08")).toMatchObject({
      exchange_id: "exchange-2026-a",
      exchange_role: "given",
      exchange_other_date: "2026-09-01",
    });
    expect(data.get("user/user-a/entry/2026-09-01")).toMatchObject({
      exchange_id: "exchange-2026-a",
      exchange_role: "return",
      exchange_other_date: "2026-09-08",
    });

    const first = data.get("user/user-a/entry/2026-09-01") as { updated_at: string };
    const second = data.get("user/user-a/entry/2026-09-08") as { updated_at: string };
    const note = await calendarHandler(request({
      action: "save-entry",
      date: "2026-09-01",
      noteText: "À confirmer avec Camille",
      noteColor: "#D3943D",
      expectedUpdatedAt: first.updated_at,
    }));
    expect(note.status).toBe(200);
    expect(data.get("user/user-a/entry/2026-09-01")).toMatchObject({
      note_text: "À confirmer avec Camille",
      exchange_id: "exchange-2026-a",
    });

    const firstWithNote = data.get("user/user-a/entry/2026-09-01") as { updated_at: string };
    const remove = await calendarHandler(request({
      action: "delete-exchange",
      id: "exchange-2026-a",
      agreementDate: "2026-09-08",
      returnDate: "2026-09-01",
      expectedUpdatedAts: {
        "2026-09-01": firstWithNote.updated_at,
        "2026-09-08": second.updated_at,
      },
    }));
    expect(remove.status).toBe(200);
    expect(data.get("user/user-a/entry/2026-09-01")).toMatchObject({
      note_text: "À confirmer avec Camille",
    });
    expect(data.has("user/user-a/entry/2026-09-08")).toBe(false);
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

  it("conserve un accident de travail comme catégorie distincte de la maladie", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-period",
      id: "work-accident-2026-09-09",
      from: "2026-09-09",
      to: "2026-09-11",
      leaveType: "work_accident",
      group: 2,
    }));
    expect(response.status).toBe(200);
    expect(data.get("user/user-a/period/work-accident-2026-09-09")).toMatchObject({
      leave_type: "work_accident",
      from: "2026-09-09",
      to: "2026-09-11",
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

  it("préserve une note enregistrée sur un autre appareil pendant l’échec d’un lot", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    data.set("user/user-a/entry/2026-09-04", { date: "2026-09-04", updated_at: "newer" });
    let firstWrite = true;
    store.setJSON.mockImplementation(async (key, value, options) => {
      const result = await setStoredJson(key, value, options);
      if (firstWrite && key.endsWith("2026-09-03") && result.modified) {
        firstWrite = false;
        data.set("user/user-a/entry/2026-09-20", { date: "2026-09-20", note_text: "Note autre appareil", updated_at: "concurrent" });
      }
      return result;
    });
    const response = await calendarHandler(request({ action: "batch", operations: [
      { action: "save-entry", date: "2026-09-03", noteText: "Lot" },
      { action: "save-entry", date: "2026-09-04", expectedUpdatedAt: "ancienne-version", noteText: "Échec" },
    ] }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ rolled_back: true });
    expect(data.get("user/user-a/entry/2026-09-20")).toMatchObject({ note_text: "Note autre appareil" });
  });

  it("n’annonce pas une restauration complète si la donnée du lot a changé entre-temps", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    data.set("user/user-a/entry/2026-09-04", { date: "2026-09-04", updated_at: "newer" });
    let injected = false;
    store.getWithMetadata.mockImplementation(async (key) => {
      if (!injected && key.endsWith("2026-09-04") && (data.get("user/user-a/entry/2026-09-03") as { note_text?: string } | undefined)?.note_text === "Lot") {
        injected = true;
        data.set("user/user-a/entry/2026-09-03", { date: "2026-09-03", note_text: "Version plus récente", updated_at: "concurrent" });
      }
      return getStoredWithMetadata(key);
    });
    const response = await calendarHandler(request({ action: "batch", operations: [
      { action: "save-entry", date: "2026-09-03", noteText: "Lot" },
      { action: "save-entry", date: "2026-09-04", expectedUpdatedAt: "ancienne-version", noteText: "Échec" },
    ] }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ rolled_back: false, rollback_error: expect.any(String) });
    expect(data.get("user/user-a/entry/2026-09-03")).toMatchObject({ note_text: "Version plus récente" });
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

  it("enregistre une demande de congé atomique avec ses identifiants stables", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-request",
      requestId: "request-annual-2026",
      requestKind: "leave",
      group: 2,
      periods: [
        { from: "2026-09-14", to: "2026-09-16", type: "annual" },
      ],
      timed: [
        { date: "2026-09-18", type: "half", start: "09:00" },
      ],
    }));
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      periods: Array<{ id: string; leave_type: string; half_moment: string }>;
    };
    expect(payload.periods).toHaveLength(2);
    expect(payload.periods[0]).toMatchObject({
      id: "request-annual-2026-1",
      leave_type: "annual",
    });
    expect(payload.periods[1]).toMatchObject({
      id: "request-annual-2026-2",
      leave_type: "half",
      half_moment: "morning",
    });
    expect(data.get("user/user-a/period/request-annual-2026-1")).toBeTruthy();
    expect(data.get("user/user-a/period/request-annual-2026-2")).toBeTruthy();
  });

  it("refuse CA, RTT, fractionnement et demi-journée lorsque leur solde est nul", async () => {
    data.set("user/user-a/form-profile", {
      manual_adjustments: {
        "2026": {
          annual_used: 29,
          rtt_used: 15,
          fraction_used: 2,
          sunday_leave_jan_jun: 0,
          sunday_leave_jul_sep: 0,
          sunday_leave_oct_nov: 0,
          sunday_leave_dec: 0,
        },
      },
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const cases = [
      ["annual", "Vous n’avez plus de congés annuels disponibles."],
      ["rtt", "Vous n’avez plus de RTT disponibles."],
      ["fraction", "Vous n’avez plus de jours de fractionnement disponibles."],
    ] as const;
    for (const [type, error] of cases) {
      const response = await calendarHandler(request({
        action: "save-request",
        requestId: `request-zero-${type}`,
        requestKind: "leave",
        group: 2,
        periods: [{ from: "2026-08-11", to: "2026-08-11", type }],
        timed: [],
      }));
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error });
      expect(data.has(`user/user-a/period/request-zero-${type}-1`)).toBe(false);
    }

    const halfDay = await calendarHandler(request({
      action: "save-request",
      requestId: "request-zero-half",
      requestKind: "leave",
      group: 2,
      periods: [],
      timed: [{ date: "2026-08-11", type: "half", start: "09:00" }],
    }));
    expect(halfDay.status).toBe(409);
    expect(await halfDay.json()).toEqual({
      error: "Vous n’avez plus de congés annuels disponibles.",
    });
  });

  it("contrôle le solde avant d’enregistrer une demande de récupération", async () => {
    data.set("user/user-a/overtime/overtime-credit-2026", {
      id: "overtime-credit-2026",
      date: "2026-09-01",
      minutes: 180,
      day_minutes: 180,
      night_minutes: 0,
      disposition: "recovery",
      input_mode: "duration",
      updated_at: "2026-09-01T10:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const accepted = await calendarHandler(request({
      action: "save-request",
      requestId: "request-recovery-ok",
      requestKind: "recovery",
      group: 2,
      periods: [],
      timed: [
        {
          date: "2026-09-17",
          type: "recovery_hours",
          start: "10:00",
          end: "11:30",
        },
      ],
    }));
    expect(accepted.status).toBe(200);
    expect(data.get("user/user-a/recovery-use/request-recovery-ok-recovery-1")).toMatchObject({
      minutes: 90,
      start: "10:00",
      end: "11:30",
    });

    const refused = await calendarHandler(request({
      action: "save-request",
      requestId: "request-recovery-too-long",
      requestKind: "recovery",
      group: 2,
      periods: [
        { from: "2026-09-20", to: "2026-09-20", type: "recovery_day" },
      ],
      timed: [],
    }));
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({
      error: "Le solde d’heures de récupération est insuffisant pour cette demande.",
    });
    expect(
      data.has("user/user-a/recovery-use/request-recovery-too-long-recovery-1"),
    ).toBe(false);
  });

  it("n’accepte pas deux consommations simultanées du même solde", async () => {
    data.set("user/user-a/overtime/overtime-credit-concurrent", {
      id: "overtime-credit-concurrent",
      date: "2026-09-01",
      minutes: 480,
      day_minutes: 480,
      night_minutes: 0,
      disposition: "recovery",
      input_mode: "duration",
      updated_at: "2026-09-01T10:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const recoveryRequest = (id: string, date: string) => calendarHandler(request({
      action: "save-request",
      requestId: id,
      requestKind: "recovery",
      group: 2,
      periods: [{ from: date, to: date, type: "recovery_day" }],
      timed: [],
    }));

    const responses = await Promise.all([
      recoveryRequest("request-concurrent-a", "2026-09-23"),
      recoveryRequest("request-concurrent-b", "2026-09-24"),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const savedUses = [...data.keys()].filter((key) => key.includes("request-concurrent-") && key.includes("recovery-use/"));
    expect(savedUses).toHaveLength(1);
  });

  it("enregistre la durée de formation choisie manuellement", async () => {
    data.set("user/user-a/overtime/overtime-credit-2026", {
      id: "overtime-credit-2026",
      date: "2026-09-01",
      minutes: 600,
      day_minutes: 600,
      night_minutes: 0,
      disposition: "recovery",
      input_mode: "duration",
      updated_at: "2026-09-01T10:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-request",
      requestId: "request-training-invalid",
      requestKind: "recovery",
      group: 2,
      periods: [],
      timed: [{
        date: "2026-09-19",
        type: "recovery_training",
        start: "10:00",
        end: "11:00",
      }],
    }));
    expect(response.status).toBe(200);
    expect(data.get("user/user-a/recovery-use/request-training-invalid-recovery-1")).toMatchObject({
      minutes: 60,
      kind: "training",
    });
  });

  it("restaure l’état précédent si une demande atomique échoue en cours d’écriture", async () => {
    data.set("user/user-a/migration/legacy-import-v1", { status: "no-legacy-data" });
    const previous = {
      id: "request-rollback-2026-1",
      from: "2026-09-21",
      to: "2026-09-21",
      leave_type: "rtt",
      half_moment: "",
      group: 2,
      updated_at: "2026-08-01T00:00:00.000Z",
    };
    data.set("user/user-a/period/request-rollback-2026-1", previous);
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    let periodWrites = 0;
    store.setJSON.mockImplementation(async (
      key: string,
      value: unknown,
      options?: { onlyIfNew?: boolean },
    ) => {
      if (key.startsWith("user/user-a/period/")) {
        periodWrites += 1;
        if (periodWrites === 2) throw new Error("Écriture interrompue");
      }
      return setStoredJson(key, value, options);
    });
    const response = await calendarHandler(request({
      action: "save-request",
      requestId: "request-rollback-2026",
      requestKind: "leave",
      group: 2,
      periods: [
        { from: "2026-09-21", to: "2026-09-21", type: "annual" },
        { from: "2026-09-22", to: "2026-09-22", type: "annual" },
      ],
      timed: [],
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "La demande n’a pas pu être enregistrée. Aucune donnée n’a été modifiée.",
    });
    expect(data.get("user/user-a/period/request-rollback-2026-1")).toEqual(previous);
    expect(data.has("user/user-a/period/request-rollback-2026-2")).toBe(false);
  });

  it("restaure toutes les familles de données après en avoir archivé l’état précédent", async () => {
    data.set("user/user-a/entry/2026-08-01", {
      date: "2026-08-01",
      note_text: "État précédent",
      note_color: "#D3943D",
      leave: false,
      updated_at: "2026-08-01T08:00:00.000Z",
    });
    data.set("user/user-a/period/old-period-2026", {
      id: "old-period-2026",
      from: "2026-08-02",
      to: "2026-08-02",
      leave_type: "annual",
      updated_at: "2026-08-01T08:00:00.000Z",
    });
    data.set("user/user-a/overtime/old-overtime-2026", { id: "old-overtime-2026" });
    data.set("user/user-a/recovery-use/old-recovery-2026", { id: "old-recovery-2026" });
    data.set("user/user-a/mecenat/old-mecenat-2026", { id: "old-mecenat-2026" });
    data.set("user/user-a/form-profile", {
      full_name: "Ancien profil",
      group: "1",
      signature: "",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "restore-backup",
      backup: {
        version: 1,
        entries: [{ date: "2026-09-01", note_text: "Restauré", leave: false }],
        periods: [{
          id: "restored-period-2026",
          from: "2026-09-02",
          to: "2026-09-03",
          leave_type: "rtt",
        }],
        overtime_entries: [{
          id: "restored-overtime-2026",
          date: "2026-09-04",
          minutes: 60,
          day_minutes: 60,
          night_minutes: 0,
          disposition: "paid",
          input_mode: "duration",
        }],
        recovery_uses: [{
          id: "restored-recovery-2026",
          date: "2026-09-05",
          minutes: 30,
        }],
        mecenat_entries: [{
          id: "restored-mecenat-2026",
          date: "2026-09-06",
          start: "19:00",
          end: "22:00",
          day_minutes: 180,
          night_minutes: 0,
          gross_amount_cents: 6870,
          pay_year: 2026,
          pay_month: 9,
        }],
        form_profile: {
          full_name: "Profil restauré",
          group: "3",
          signature: "",
          status: "fonctionnaire",
        },
      },
    }));
    expect(response.status).toBe(200);
    expect(data.get("user/user-a/entry/2026-09-01")).toMatchObject({
      note_text: "Restauré",
    });
    expect(data.get("user/user-a/period/restored-period-2026")).toBeTruthy();
    expect(data.get("user/user-a/overtime/restored-overtime-2026")).toBeTruthy();
    expect(data.get("user/user-a/recovery-use/restored-recovery-2026")).toBeTruthy();
    expect(data.get("user/user-a/mecenat/restored-mecenat-2026")).toBeTruthy();
    expect(data.get("user/user-a/form-profile")).toMatchObject({
      full_name: "Profil restauré",
      group: "3",
    });
    const archivedKeys = [...data.keys()].filter((key) =>
      key.startsWith("user/user-a/restore-archive/"),
    );
    expect(archivedKeys.some((key) => key.endsWith("/entry/2026-08-01"))).toBe(true);
    expect(archivedKeys.some((key) => key.endsWith("/period/old-period-2026"))).toBe(true);
    expect(archivedKeys.some((key) => key.endsWith("/form-profile"))).toBe(true);
  });

  it("valide et historise toutes les branches du profil sans effacer les champs absents", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const first = await calendarHandler(request({
      action: "save-form-profile",
      fullName: "Compte complet",
      group: "2",
      signature: "",
      status: "fonctionnaire",
      workQuota: "three_quarters",
      workSchedule: { start: "09:15", end: "19:45" },
      baseSalaryCents: 180173,
      residenceAllowanceCents: 5405,
      ifseCents: 32500,
      ciaCents: 24000,
      ciaMonth: 6,
      netRatioFixedBp: 7737,
      netRatioVariableBp: 8200,
      netRatioRegime: "culture-psc",
      manualYear: 2026,
      manualAnnualUsed: 4.5,
      manualRttUsed: 2,
      manualFractionUsed: 1,
      manualSundayLeaveJanJun: 2,
      manualSundayLeaveJulSep: 1,
      manualSundayLeaveOctNov: 0,
      manualSundayLeaveDec: 1,
      payYear: 2026,
      payMonth: 7,
      monthlyPayProfiles: [
        { year: 2026, month: 8, baseSalaryCents: 181000, residenceAllowanceCents: 5430 },
      ],
      cetAccount: {
        enabled: true,
        employer: "public-establishment",
        employerName: "Centre Pompidou",
        category: "B",
        workRule: "visitor_service",
        hasOneYearService: true,
        isTrainee: false,
        openedOn: "2025-01-02",
        initialBalance: 12,
        legacyCap70: false,
        operations: [{
          id: "cet-operation-2026",
          date: "2026-12-01",
          kind: "deposit",
          days: 3,
          source: "rtt",
          note: "Relevé RH",
        }],
      },
    }));
    expect(first.status).toBe(200);
    const stored = data.get("user/user-a/form-profile") as {
      group: string;
      status: string;
      pay_profiles: Record<string, { base_salary_cents?: number }>;
      manual_adjustments: Record<string, { annual_used: number }>;
      cet_account: { employer_name: string; operations: unknown[] };
    };
    expect(stored.pay_profiles["2026-08"].base_salary_cents).toBe(180173);
    expect(stored.pay_profiles["2026-09"].base_salary_cents).toBe(181000);
    expect(stored.manual_adjustments["2026"].annual_used).toBe(4.5);
    expect(stored.cet_account).toMatchObject({
      employer_name: "Centre Pompidou",
      operations: [{ kind: "deposit", source: "rtt" }],
    });

    const partial = await calendarHandler(request({
      action: "save-form-profile",
      fullName: "Nom actualisé",
      signature: "",
    }));
    expect(partial.status).toBe(200);
    expect(data.get("user/user-a/form-profile")).toMatchObject({
      full_name: "Nom actualisé",
      group: "2",
      status: "fonctionnaire",
      work_quota: "three_quarters",
      work_schedule: { start: "09:15", end: "19:45" },
      cet_account: { employer_name: "Centre Pompidou" },
    });
  });

  it("conserve les montants des mois précédents lors d’un changement de paie daté", async () => {
    data.set("user/user-a/form-profile", {
      full_name: "Agent",
      group: "2",
      signature: "",
      status: "fonctionnaire",
      work_quota: "full",
      base_salary_cents: 200000,
      ifse_cents: 30000,
      pas_rate_bp: 500,
      pay_profiles: {
        "2026": { base_salary_cents: 200000, ifse_cents: 30000, pas_rate_bp: 500 },
      },
      updated_at: "2026-08-01T00:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);

    const response = await calendarHandler(request({
      action: "save-form-profile",
      fullName: "Agent",
      group: "2",
      signature: "",
      payYear: 2026,
      payMonth: 8,
      ifseCents: 32500,
      pasRateBp: 600,
    }));

    expect(response.status).toBe(200);
    const stored = data.get("user/user-a/form-profile") as {
      pay_profiles: Record<string, { ifse_cents?: number; pas_rate_bp?: number }>;
    };
    expect(stored.pay_profiles["2026"]).toMatchObject({ ifse_cents: 30000, pas_rate_bp: 500 });
    expect(stored.pay_profiles["2026-09"]).toMatchObject({ ifse_cents: 32500, pas_rate_bp: 600 });
  });

  it("refuse les signatures, CET et rattrapages invalides sans modifier le profil", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    for (const body of [
      { action: "save-form-profile", signature: "data:image/jpeg;base64,abc" },
      { action: "save-form-profile", signature: "", cetAccount: { employer: "invalid" } },
      { action: "save-form-profile", signature: "", manualYear: 1999 },
      {
        action: "save-form-profile",
        signature: "",
        manualYear: 2026,
        manualAnnualUsed: 29.5,
        manualRttUsed: 0,
        manualFractionUsed: 0,
        manualSundayLeaveJanJun: 0,
        manualSundayLeaveJulSep: 0,
        manualSundayLeaveOctNov: 0,
        manualSundayLeaveDec: 0,
      },
    ]) {
      const response = await calendarHandler(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty("error");
    }
    expect(data.has("user/user-a/form-profile")).toBe(false);
  });

  it("archive seulement les anciennes données appartenant au compte connecté", async () => {
    data.set("migration/legacy-owner-v1", {
      user_id: "user-a",
      claimed_at: "2026-08-01T00:00:00.000Z",
    });
    data.set("user/user-a/migration/legacy-import-v1", { status: "migrated" });
    data.set("entry/2026-07-01", { date: "2026-07-01", note_text: "Ancienne" });
    data.set("period/legacy-period-2026", {
      id: "legacy-period-2026",
      from: "2026-07-02",
      to: "2026-07-03",
    });
    data.set("form-profile", { full_name: "Profil ancien", group: "1" });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "archive-legacy-data",
      confirmation: "ARCHIVER",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ archived: 3 });
    expect(data.get("user/user-a/legacy-archive-v1/entry/2026-07-01")).toBeTruthy();
    expect(data.get("user/user-a/legacy-archive-v1/period/legacy-period-2026")).toBeTruthy();
    expect(data.get("user/user-a/legacy-archive-v1/form-profile")).toBeTruthy();
    expect(data.has("entry/2026-07-01")).toBe(false);
    expect(data.has("period/legacy-period-2026")).toBe(false);
    expect(data.has("form-profile")).toBe(false);
  });

  it("interdit l’archivage historique au compte qui n’en est pas propriétaire", async () => {
    data.set("migration/legacy-owner-v1", {
      user_id: "user-b",
      claimed_at: "2026-08-01T00:00:00.000Z",
    });
    data.set("user/user-a/migration/legacy-import-v1", {
      status: "owned-by-another-user",
    });
    data.set("entry/2026-07-01", { date: "2026-07-01" });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "archive-legacy-data",
      confirmation: "ARCHIVER",
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Ces données historiques ne vous appartiennent pas",
    });
    expect(data.has("entry/2026-07-01")).toBe(true);
  });

  it("rend la sauvegarde de périodes idempotente sans réécriture inutile", async () => {
    const existing = {
      id: "bulk-idempotent-2026",
      from: "2026-10-01",
      to: "2026-10-02",
      leave_type: "annual",
      half_moment: "",
      group: 2,
      updated_at: "2026-08-01T00:00:00.000Z",
    };
    data.set("user/user-a/migration/legacy-import-v1", { status: "no-legacy-data" });
    data.set("user/user-a/period/bulk-idempotent-2026", existing);
    store.setJSON.mockClear();
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await calendarHandler(request({
      action: "save-periods",
      periods: [{
        id: "bulk-idempotent-2026",
        from: "2026-10-01",
        to: "2026-10-02",
        leaveType: "annual",
        group: 2,
      }],
    }));
    expect(response.status).toBe(200);
    expect(store.setJSON).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ periods: [existing] });
  });

  it("confirme par relecture un lot écrit malgré une réponse de stockage perdue", async () => {
    data.set("user/user-a/migration/legacy-import-v1", { status: "no-legacy-data" });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    store.setJSON.mockImplementationOnce(async (key: string, value: unknown) => {
      data.set(key, value);
      throw new Error("Réponse réseau perdue");
    });
    const response = await calendarHandler(request({
      action: "save-periods",
      periods: [{
        id: "bulk-recovered-2026",
        from: "2026-10-03",
        to: "2026-10-04",
        leaveType: "rtt",
        group: 2,
      }],
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      recovered: true,
      periods: [{ id: "bulk-recovered-2026" }],
    });
  });

  it("annule intégralement un lot de périodes réellement incomplet", async () => {
    data.set("user/user-a/migration/legacy-import-v1", { status: "no-legacy-data" });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    let periodWrites = 0;
    store.setJSON.mockImplementation(async (
      key: string,
      value: unknown,
      options?: { onlyIfNew?: boolean },
    ) => {
      if (key.startsWith("user/user-a/period/")) {
        periodWrites += 1;
        if (periodWrites === 2) throw new Error("Écriture refusée");
      }
      return setStoredJson(key, value, options);
    });
    const response = await calendarHandler(request({
      action: "save-periods",
      periods: [
        {
          id: "bulk-rollback-one-2026",
          from: "2026-10-05",
          to: "2026-10-05",
          leaveType: "annual",
          group: 2,
        },
        {
          id: "bulk-rollback-two-2026",
          from: "2026-10-06",
          to: "2026-10-06",
          leaveType: "annual",
          group: 2,
        },
      ],
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Les congés n’ont pas pu être enregistrés. Aucune donnée n’a été modifiée.",
    });
    expect(data.has("user/user-a/period/bulk-rollback-one-2026")).toBe(false);
    expect(data.has("user/user-a/period/bulk-rollback-two-2026")).toBe(false);
  });
});
