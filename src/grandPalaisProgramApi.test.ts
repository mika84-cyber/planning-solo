import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSharedGrandPalaisProgram,
  GrandPalaisProgramApiError,
  reviewGrandPalaisProposal,
} from "./grandPalaisProgramApi";
import type { GrandPalaisProgramPayload } from "./grandPalaisProgramTypes";

const event = {
  id: "event-1",
  title: "Exposition test",
  startDate: "2026-09-01",
  endDate: "2027-01-03",
  url: "https://www.grandpalais.fr/fr/evenement/test",
  venueKey: "gallery-8",
  venueLabel: "Galerie 8",
  approvedAt: "2026-08-29T10:00:00.000Z",
};

const payload: GrandPalaisProgramPayload = {
  approved: [event],
  pending: [
    {
      id: "proposal-1",
      kind: "changed",
      detectedAt: "2026-08-29T11:00:00.000Z",
      previous: event,
      next: { ...event, endDate: "2027-01-10" },
    },
  ],
  isAdmin: true,
  lastCheckedAt: "2026-08-29T11:30:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("API de programmation du Grand Palais", () => {
  it("charge et valide la programmation sans cache public", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSharedGrandPalaisProgram()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/gp-program", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("envoie la décision d’administration avec le payload attendu", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reviewGrandPalaisProposal("proposal-1", "accept"),
    ).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/gp-program", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: "proposal-1", decision: "accept" }),
    });
  });

  it.each([
    null,
    { approved: [], pending: [], isAdmin: "oui" },
    { approved: [{ ...event, title: 42 }], pending: [], isAdmin: false },
    {
      approved: [],
      pending: [{ id: "proposal-1", kind: "unexpected", detectedAt: "now" }],
      isAdmin: false,
    },
  ])("refuse un payload de succès invalide", async (invalidPayload) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(invalidPayload), { status: 200 }),
      ),
    );

    await expect(getSharedGrandPalaisProgram()).rejects.toEqual(
      new GrandPalaisProgramApiError(
        "La réponse de programmation reçue est invalide.",
        502,
      ),
    );
  });

  it("restitue le message d’une erreur HTTP JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Accès administrateur requis" }), {
          status: 403,
        }),
      ),
    );

    await expect(getSharedGrandPalaisProgram()).rejects.toEqual(
      new GrandPalaisProgramApiError("Accès administrateur requis", 403),
    );
  });

  it("utilise un message sûr quand l’erreur HTTP n’est pas du JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("indisponible", { status: 503 })),
    );

    await expect(getSharedGrandPalaisProgram()).rejects.toEqual(
      new GrandPalaisProgramApiError(
        "La programmation partagée n’a pas pu être chargée.",
        503,
      ),
    );
  });

  it("laisse remonter une panne réseau sans la masquer", async () => {
    const networkError = new TypeError("Network request failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    await expect(getSharedGrandPalaisProgram()).rejects.toBe(networkError);
  });
});
