import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CalendarApiError,
  calendarErrorMessage,
  getCalendar,
  postCalendar,
  postCalendarBatch,
  postCalendarIdempotent,
  postCalendarPeriodsVerified,
} from "./calendarApi";

afterEach(() => vi.unstubAllGlobals());

describe("client de l'API calendrier", () => {
  it("configure les lectures sans cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ entries: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCalendar<{ entries: unknown[] }>()).resolves.toEqual({
      entries: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendar",
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
    );
  });

  it("envoie les écritures en JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await postCalendar({ action: "save-entry", date: "2026-08-17" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendar",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "save-entry",
          date: "2026-08-17",
        }),
      }),
    );
  });

  it("regroupe les écritures liées dans une seule requête", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, results: [{ ok: true }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await postCalendarBatch([{ action: "save-leaves", date: "2026-08-17" }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: "batch",
      operations: [{ action: "save-leaves", date: "2026-08-17" }],
    });
  });

  it("remonte le message explicite et le statut du serveur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Date invalide" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const error = await postCalendar({ action: "save-entry" }).catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(CalendarApiError);
    expect(error).toMatchObject({ message: "Date invalide", status: 400 });
    expect(calendarErrorMessage(error, "Échec")).toBe("Date invalide");
  });

  it("réessaie une écriture idempotente après une erreur réseau transitoire", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, periods: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      postCalendarIdempotent({ action: "save-periods", periods: [] }),
    ).resolves.toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });

  it("ne réessaie pas une erreur métier", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Date invalide" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      postCalendarIdempotent({ action: "save-periods", periods: [] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("confirme par relecture un lot enregistré malgré deux réponses perdues", async () => {
    const savedPeriods = Array.from({ length: 7 }, (_, index) => ({
      id: `period-confirmed-${index}`,
      from: `2026-08-${String(index + 4).padStart(2, "0")}`,
      to: `2026-08-${String(index + 4).padStart(2, "0")}`,
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ periods: savedPeriods }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      postCalendarPeriodsVerified(savedPeriods),
    ).resolves.toMatchObject({
      ok: true,
      recovered: true,
      periods: savedPeriods,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ cache: "no-store" });
  });

  it("conserve une vraie erreur lorsque le lot est absent à la relecture", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ periods: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      postCalendarPeriodsVerified([
        { id: "period-missing-1234", from: "2026-08-04", to: "2026-08-04" },
      ]),
    ).rejects.toMatchObject({ status: 503 });
  });
});
