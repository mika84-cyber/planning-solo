import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CalendarApiError,
  calendarErrorMessage,
  getCalendar,
  postCalendar,
  postCalendarBatch,
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
});
