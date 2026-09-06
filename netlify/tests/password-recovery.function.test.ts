import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestPasswordRecovery: vi.fn(async () => undefined),
  store: {
    get: vi.fn(async () => null),
    setJSON: vi.fn(async () => undefined),
  },
}));

vi.mock("@netlify/blobs", () => ({ getStore: () => mocks.store }));
vi.mock("@netlify/identity", () => ({
  requestPasswordRecovery: mocks.requestPasswordRecovery,
}));

import handler from "../functions/password-recovery.mts";

function request(email = "invite@example.test", origin = "https://planning-solo.netlify.app") {
  return new Request("https://planning-solo.netlify.app/api/password-recovery", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email }),
  });
}

describe("fonction de récupération de mot de passe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.get.mockResolvedValue(null);
  });

  it("demande à Identity d’envoyer le lien au compte normalisé", async () => {
    const response = await handler(request(" Invite@Example.test "));
    expect(response.status).toBe(202);
    expect(mocks.requestPasswordRecovery).toHaveBeenCalledWith("invite@example.test");
  });

  it("ne révèle pas si Identity refuse l’adresse demandée", async () => {
    mocks.requestPasswordRecovery.mockRejectedValueOnce(new Error("User not found"));
    const response = await handler(request("inconnu@example.test"));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("refuse une requête provenant d’un autre site", async () => {
    const response = await handler(request("invite@example.test", "https://attaque.example"));
    expect(response.status).toBe(403);
    expect(mocks.requestPasswordRecovery).not.toHaveBeenCalled();
  });

  it("limite les demandes répétées pour une même adresse", async () => {
    mocks.store.get.mockResolvedValue({ attemptedAt: new Date().toISOString() });
    const response = await handler(request());
    expect(response.status).toBe(202);
    expect(mocks.requestPasswordRecovery).not.toHaveBeenCalled();
  });
});
