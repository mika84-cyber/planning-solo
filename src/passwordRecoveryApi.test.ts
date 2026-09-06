import { describe, expect, it, vi } from "vitest";
import { requestPasswordRecovery } from "./passwordRecoveryApi";

describe("API de récupération de mot de passe", () => {
  it("envoie l’adresse au service sécurisé de l’application", async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true }, { status: 202 }));
    await requestPasswordRecovery("invite@example.test", fetcher as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith("/api/password-recovery", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({ email: "invite@example.test" }),
    }));
  });

  it("signale une indisponibilité du service", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: "indisponible" }, { status: 503 }));
    await expect(requestPasswordRecovery("invite@example.test", fetcher as typeof fetch))
      .rejects.toThrow("a échoué");
  });
});
