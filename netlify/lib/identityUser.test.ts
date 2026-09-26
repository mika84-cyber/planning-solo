import { describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@netlify/identity", () => identity);

import { currentUser } from "./identityUser.mts";

describe("utilisateur connecté côté serveur", () => {
  it("lit le jeton vérifié par Netlify sans rappeler le service d'identité", async () => {
    const user = await currentUser({
      url: "https://planning.test/.netlify/identity",
      token: "cle-de-service",
      user: {
        sub: "u-1",
        email: "mika@example.test",
        app_metadata: { provider: "email", roles: ["admin"] },
        user_metadata: { full_name: "Mika" },
      },
    });
    expect(user).toMatchObject({ id: "u-1", email: "mika@example.test", name: "Mika", roles: ["admin"] });
    expect(identity.getUser).not.toHaveBeenCalled();
  });

  it("refuse une demande sans jeton valable", async () => {
    await expect(currentUser({ url: "https://planning.test/.netlify/identity", token: "cle" })).resolves.toBeNull();
    expect(identity.getUser).not.toHaveBeenCalled();
  });

  it("laisse la bibliothèque décider hors de la plateforme", async () => {
    identity.getUser.mockResolvedValue({ id: "local" });
    await expect(currentUser(undefined)).resolves.toEqual({ id: "local" });
  });
});
