import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isMikaSharingAccount,
  forwardNotificationRequest,
  mirrorSharedCalendarAction,
  readAgnesSharedCalendar,
  sharedOperations,
  syncExistingSharedCalendar,
} from "./sharedCalendarBridge.mts";

function setEnvironment(values: Record<string, string>) {
  Object.defineProperty(globalThis, "Netlify", {
    configurable: true,
    value: { env: { get: (key: string) => values[key] } },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "Netlify");
  vi.unstubAllGlobals();
});

describe("passerelle du calendrier partagé", () => {
  it("limite l’activation au compte explicitement configuré", async () => {
    setEnvironment({ PLANNING_SHARED_OWNER_EMAIL: "mika@example.test" });
    await expect(isMikaSharingAccount("MIKA@example.test")).resolves.toBe(true);
    await expect(isMikaSharingAccount("collegue@example.test")).resolves.toBe(false);
  });

  it("partage uniquement les dates d’absence, sans leur motif ni la paie", () => {
    expect(sharedOperations({ action: "save-period", leaveType: "sick" }, {
      period: { id: "p2", from: "2026-09-03", to: "2026-09-04", leave_type: "sick" },
    })).toEqual([expect.objectContaining({ action: "bridge-save-mika-away-period", id: "p2" })]);
    expect(sharedOperations({ action: "save-form-profile", baseSalary: 3000 })).toEqual([]);
    expect(sharedOperations({ action: "save-period", id: "p1", from: "2026-09-01", to: "2026-09-02", leaveType: "annual" }, {
      period: { id: "p1", from: "2026-09-01", to: "2026-09-02", leave_type: "annual" },
    })).toEqual([expect.objectContaining({ action: "bridge-save-mika-away-period" })]);
    expect(JSON.stringify(sharedOperations({ action: "save-period" }, {
      period: { id: "p3", from: "2026-09-05", to: "2026-09-05", leave_type: "work_accident" },
    }))).not.toContain("work_accident");
    expect(sharedOperations({ action: "save-period" }, {
      period: { id: "p4", from: "2026-09-05", to: "2026-09-05", leave_type: "half" },
    })).toEqual([]);
  });

  it("transmet la suppression d’une note d’Agnès sans toucher aux notes de Mika", () => {
    expect(sharedOperations({
      action: "delete-shared-partner-note",
      groupId: "note-agnes-1",
      date: "2026-09-04",
    })).toEqual([{
      action: "bridge-delete-agnes-note",
      groupId: "note-agnes-1",
      date: "2026-09-04",
    }]);
  });

  it("lit et écrit avec le secret uniquement dans l’en-tête serveur", async () => {
    setEnvironment({
      PLANNING_SHARED_API_URL: "https://agnes.example.test/api/calendar",
      PLANNING_SHARED_BRIDGE_SECRET: "secret-de-test",
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [{ date: "2026-09-01" }], periods: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAgnesSharedCalendar(true)).resolves.toMatchObject({ status: "connected", entries: [{ date: "2026-09-01" }] });
    await expect(mirrorSharedCalendarAction(true, {
      action: "save-note-period",
      from: "2026-09-01",
      to: "2026-09-01",
      noteText: "Note partagée",
    })).resolves.toBe("shared");

    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(request.headers).toMatchObject({ "x-planning-bridge": "secret-de-test" });
    expect(String(request.body)).not.toContain("baseSalary");
  });

  it("reprend les notes et absences déjà enregistrées", async () => {
    setEnvironment({
      PLANNING_SHARED_API_URL: "https://agnes.example.test/api/calendar",
      PLANNING_SHARED_BRIDGE_SECRET: "secret-de-test",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(syncExistingSharedCalendar(true, [{
      date: "2026-09-06", note_text: "Note existante", note_color: "#D3943D", leave: true,
    }], [{ id: "p5", from: "2026-09-07", to: "2026-09-08", leave_type: "annual" }])).resolves.toBe("shared");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload).toMatchObject({ action: "bridge-sync-mika-calendar", awayDates: ["2026-09-06"] });
    expect(payload.notes[0].text).toBe("Note existante");
    expect(payload.awayPeriods[0]).toEqual({ id: "p5", from: "2026-09-07", to: "2026-09-08" });
    expect(String(request.body)).not.toContain("annual");
  });

  it("transmet l’abonnement push de Mika sans exposer le secret au navigateur", async () => {
    setEnvironment({
      PLANNING_SHARED_API_URL: "https://agnes.example.test/api/calendar",
      PLANNING_SHARED_BRIDGE_SECRET: "secret-de-test",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ publicKey: "cle-publique" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await forwardNotificationRequest("GET");
    await expect(response?.json()).resolves.toEqual({ publicKey: "cle-publique" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://agnes.example.test/api/notifications?bridge=planning-solo",
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).toMatchObject({ "x-planning-bridge": "secret-de-test" });
  });
});
