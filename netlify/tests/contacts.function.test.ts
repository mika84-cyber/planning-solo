import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@netlify/identity", () => ({ getUser: vi.fn() }));

import { getUser } from "@netlify/identity";
import contactsHandler from "../functions/contacts.mts";

const mockedGetUser = vi.mocked(getUser);

describe("fonction sécurisée des contacts", () => {
  beforeEach(() => mockedGetUser.mockReset());

  it("refuse l’annuaire sans utilisateur authentifié", async () => {
    mockedGetUser.mockResolvedValue(null);
    const response = await contactsHandler(new Request("https://example.test/api/contacts"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Connexion requise" });
  });

  it("renvoie les contacts sans cache après authentification", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-1", email: "test@example.test" } as never);
    const response = await contactsHandler(new Request("https://example.test/api/contacts"));
    const payload = await response.json() as { pompidou: unknown[]; gprmn: unknown[] };
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(payload.pompidou).toHaveLength(6);
    expect(payload.gprmn).toHaveLength(2);
  });
});
