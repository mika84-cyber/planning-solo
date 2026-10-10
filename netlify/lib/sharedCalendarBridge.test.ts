import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isMikaSharingAccount,
  forwardNotificationRequest,
  mirrorMikaNoteChanges,
  mirrorSharedCalendarAction,
  readAgnesSharedCalendar,
  sharedOperations,
  sharedPeriod,
  syncExistingSharedCalendar,
  touchesSharedPeriods,
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

  it("partage les absences de la journée, jamais les notes de Mika ni la paie", () => {
    expect(sharedOperations({ action: "save-form-profile", baseSalary: 3000 })).toEqual([]);
    expect(sharedOperations({ action: "save-entry", date: "2026-09-01", leave: true, noteText: "Privée" })).toEqual([
      { action: "bridge-set-mika-away-day", date: "2026-09-01", away: true },
    ]);
    expect(sharedOperations({ action: "batch", operations: [
      { action: "save-leaves", date: "2026-09-02", leave: false },
      { action: "save-note-period", from: "2026-09-03", to: "2026-09-03", noteText: "Privée" },
    ] })).toEqual([{ action: "bridge-set-mika-away-day", date: "2026-09-02", away: false }]);
  });

  it("renvoie chaque congé avec son motif, demi-journées comprises", () => {
    expect(touchesSharedPeriods({ action: "batch", operations: [{ action: "save-period" }] })).toBe(true);
    expect(touchesSharedPeriods({ action: "save-entry", date: "2026-09-01" })).toBe(false);
    expect(sharedPeriod({ id: "p4", from: "2026-09-05", to: "2026-09-05", leave_type: "half", half_moment: "morning", group: 2 }))
      .toEqual({ id: "p4", from: "2026-09-05", to: "2026-09-05", leaveType: "half", halfMoment: "morning", group: 2 });
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
      action: "save-period",
      from: "2026-09-01",
      to: "2026-09-01",
      leaveType: "rtt",
    }, async () => [{ id: "p1", from: "2026-09-01", to: "2026-09-01", leave_type: "rtt" }])).resolves.toBe("shared");

    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(request.headers).toMatchObject({ "x-planning-bridge": "secret-de-test" });
    expect(JSON.parse(String(request.body))).toEqual({
      action: "bridge-sync-mika-calendar",
      awayDates: [],
      awayPeriods: [{ id: "p1", from: "2026-09-01", to: "2026-09-01", leaveType: "rtt", halfMoment: "" }],
    });
  });

  it("n’envoie rien pour une note de Mika", async () => {
    setEnvironment({ PLANNING_SHARED_BRIDGE_SECRET: "secret-de-test" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(mirrorSharedCalendarAction(true, { action: "save-note-period", from: "2026-09-01", to: "2026-09-01", noteText: "Privée" }, async () => []))
      .resolves.toBe("ignored");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recopie chez Agnès les notes de Mika qui viennent de changer", async () => {
    setEnvironment({ PLANNING_SHARED_BRIDGE_SECRET: "secret-de-test" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await mirrorMikaNoteChanges([
      { kind: "added", from: "2026-10-17", to: "2026-10-19", text: "Stage" },
      { kind: "deleted", from: "2026-10-20", to: "2026-10-20", text: "" },
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)))).toEqual([
      { action: "bridge-save-mika-note", from: "2026-10-17", to: "2026-10-19", noteText: "Stage" },
      { action: "bridge-delete-mika-note", from: "2026-10-20", to: "2026-10-20" },
    ]);
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
    }, {
      // Plus d'un mois avant : l'historique ancien n'est pas repris.
      date: "2026-07-01", note_text: "Note ancienne", leave: true,
    }], [{ id: "p5", from: "2026-09-07", to: "2026-09-08", leave_type: "annual" }], new Date("2026-09-20T12:00:00Z"))).resolves.toBe("shared");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload).toMatchObject({ action: "bridge-sync-mika-calendar", awayDates: ["2026-09-06"] });
    expect(payload.notes).toEqual([{ date: "2026-09-06", text: "Note existante", color: "#D3943D" }]);
    expect(payload.awayPeriods[0]).toEqual({ id: "p5", from: "2026-09-07", to: "2026-09-08", leaveType: "annual", halfMoment: "" });
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
