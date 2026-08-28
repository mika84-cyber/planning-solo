import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactsApiError, getUsefulContacts } from "./contactsApi";

afterEach(() => vi.unstubAllGlobals());

describe("API des contacts sécurisés", () => {
  it("charge l’annuaire sans utiliser le cache public", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ pompidou: [], gprmn: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUsefulContacts()).resolves.toEqual({ pompidou: [], gprmn: [] });
    expect(fetchMock).toHaveBeenCalledWith("/api/contacts", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("signale clairement qu’une connexion est nécessaire", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Connexion requise" }), { status: 401 }),
      ),
    );

    await expect(getUsefulContacts()).rejects.toEqual(
      new ContactsApiError("Connexion requise", 401),
    );
  });
});
