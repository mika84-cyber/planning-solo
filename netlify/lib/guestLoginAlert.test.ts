import { describe, expect, it, vi } from "vitest";
import {
  sendGuestLoginAlert,
  sendGuestLoginAlertOnce,
  shouldSendGuestLoginAlert,
} from "./guestLoginAlert.mts";

const env = {
  PROGRAM_ADMIN_EMAIL: "admin@example.com",
  PROGRAM_ALERT_FROM: "Planning Solo <alerte@example.com>",
  RESEND_API_KEY: "test-key",
};

describe("alerte de connexion invitée", () => {
  it("ignore la connexion du compte administrateur", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(shouldSendGuestLoginAlert("ADMIN@example.com", env.PROGRAM_ADMIN_EMAIL)).toBe(false);
    await expect(sendGuestLoginAlert("admin@example.com", new Date(), env, fetcher)).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("envoie au compte administrateur l’adresse et l’heure de la connexion invitée", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    await expect(
      sendGuestLoginAlert("Audrey@example.com", new Date("2026-08-28T12:30:00Z"), env, fetcher),
    ).resolves.toBe(true);

    const [, request] = fetcher.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.to).toEqual(["admin@example.com"]);
    expect(body.subject).toContain("compte invité");
    expect(body.html).toContain("audrey@example.com");
    expect(body.html).toContain("28 août 2026");
  });

  it("ne bloque pas silencieusement une configuration incomplète", async () => {
    await expect(
      sendGuestLoginAlert("invite@example.com", new Date(), {
        PROGRAM_ADMIN_EMAIL: "admin@example.com",
      }),
    ).rejects.toThrow("incomplètes");
  });

  it("évite plusieurs alertes rapprochées pour le même compte", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    let record: { sentAt: string } | null = null;
    const store = {
      get: vi.fn(async () => record),
      setJSON: vi.fn(async (_key: string, value: { sentAt: string }) => { record = value; }),
    };
    const first = new Date("2026-08-28T12:30:00Z");
    await expect(
      sendGuestLoginAlertOnce("guest-id", "invite@example.com", first, env, fetcher, store),
    ).resolves.toBe("sent");
    await expect(
      sendGuestLoginAlertOnce(
        "guest-id",
        "invite@example.com",
        new Date(first.getTime() + 5 * 60 * 1000),
        env,
        fetcher,
        store,
      ),
    ).resolves.toBe("throttled");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
