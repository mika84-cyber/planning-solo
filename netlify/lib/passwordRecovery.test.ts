import { describe, expect, it, vi } from "vitest";
import {
  createIdentityActionLink,
  findRecoveryUser,
  recoveryActionForUser,
  sendPasswordRecoveryEmail,
} from "./passwordRecovery.mts";

describe("récupération de mot de passe", () => {
  it("retrouve un compte invité sans tenir compte de la casse", async () => {
    const listUsers = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => ({ email: `user${index}@example.test` })))
      .mockResolvedValueOnce([{ email: "Invite@Example.test", invitedAt: "2026-01-01" }]);
    const user = await findRecoveryUser(" invite@example.TEST ", { listUsers });
    expect(user?.email).toBe("Invite@Example.test");
    expect(listUsers).toHaveBeenLastCalledWith({ page: 2, perPage: 100 });
  });

  it("choisit l’activation pour une invitation et la récupération pour un compte actif", () => {
    expect(recoveryActionForUser({ invitedAt: "2026-01-01" })).toBe("invite");
    expect(recoveryActionForUser({ confirmedAt: "2026-01-02" })).toBe("recovery");
  });

  it("génère un lien Identity limité au site Planning Solo", async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => Response.json({
        action_link: "https://planning-solo.netlify.app/.netlify/identity/verify?token=secret",
      }),
    );
    const link = await createIdentityActionLink(
      "collegue@example.test",
      "recovery",
      { url: "https://planning-solo.netlify.app/.netlify/identity", token: "operator-token" },
      "https://planning-solo.netlify.app",
      fetcher as typeof fetch,
    );
    expect(link).toContain("token=secret");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain("/admin/generate_link");
    expect((options?.headers as Record<string, string>).authorization).toBe("Bearer operator-token");
    expect(JSON.parse(String(options?.body))).toEqual({
      type: "recovery",
      email: "collegue@example.test",
      redirect_to: "https://planning-solo.netlify.app",
    });
  });

  it("envoie à chaque collègue son propre lien par Gmail", async () => {
    const gmailSender = vi.fn(async () => undefined);
    await sendPasswordRecoveryEmail(
      "collegue@example.test",
      "recovery",
      "https://planning-solo.netlify.app/reset?token=secret&next=1",
      {
        SENDGRID_FROM_EMAIL: "expediteur@gmail.com",
        GMAIL_APP_PASSWORD: "app-password",
      },
      gmailSender,
    );
    expect(gmailSender).toHaveBeenCalledWith(
      { user: "expediteur@gmail.com", appPassword: "app-password" },
      expect.objectContaining({
        to: "collegue@example.test",
        subject: expect.stringContaining("réinitialiser"),
        text: expect.stringContaining("token=secret"),
        html: expect.stringContaining("&amp;next=1"),
      }),
    );
  });
});
