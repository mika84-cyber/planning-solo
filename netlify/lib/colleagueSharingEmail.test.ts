import { describe, expect, it, vi } from "vitest";
import { sendColleagueSharingEmail } from "./colleagueSharingEmail.mts";

describe("e-mail de partage du planning", () => {
  it("envoie avec Resend un lien sans exposer de motif d’absence", async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    );
    await sendColleagueSharingEmail(
      "collegue@example.test",
      "Mika & équipe",
      { RESEND_API_KEY: "key", PROGRAM_ALERT_FROM: "Planning <planning@example.test>", URL: "https://planning.test" },
      fetcher as typeof fetch,
    );
    const request = fetcher.mock.calls[0];
    const options = request[1] as RequestInit;
    const body = JSON.parse(String(options.body)) as { to: string[]; subject: string; text: string; html: string };
    expect(body.to).toEqual(["collegue@example.test"]);
    expect(body.html).toContain("https://planning.test");
    expect(body.html).toContain("Mika &amp; équipe");
    expect(body.subject).toContain("partage son planning");
    expect(body.text).toContain("https://planning.test");
    expect(body.html).toContain("accepter ou refuser");
    expect(body.html).not.toMatch(/maladie|grève|congé annuel/i);
  });

  it("préfère SendGrid lorsqu’il est configuré", async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
    await sendColleagueSharingEmail(
      "collegue@example.test",
      "Mika & équipe",
      {
        SENDGRID_API_KEY: "sendgrid-key",
        SENDGRID_FROM_EMAIL: "expediteur@example.test",
        RESEND_API_KEY: "resend-key",
        PROGRAM_ALERT_FROM: "Planning <planning@example.test>",
        URL: "https://planning.test",
      },
      fetcher as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect((options?.headers as Record<string, string>).authorization).toBe("Bearer sendgrid-key");
    const body = JSON.parse(String(options?.body)) as {
      personalizations: Array<{ to: Array<{ email: string }> }>;
      from: { email: string; name: string };
      subject: string;
      content: Array<{ type: string; value: string }>;
      tracking_settings: {
        click_tracking: { enable: boolean; enable_text: boolean };
        open_tracking: { enable: boolean };
        subscription_tracking: { enable: boolean };
      };
    };
    expect(body.personalizations[0].to[0].email).toBe("collegue@example.test");
    expect(body.from).toEqual({ email: "expediteur@example.test", name: "Planning Solo" });
    expect(body.subject).toContain("partage son planning");
    expect(body.content[0].type).toBe("text/plain");
    expect(body.content[0].value).toContain("https://planning.test");
    expect(body.content[1].type).toBe("text/html");
    expect(body.content[1].value).toContain("Mika &amp; équipe");
    expect(body.content[1].value).toContain("https://planning.test");
    expect(body.content[1].value).not.toMatch(/maladie|grève|congé annuel/i);
    expect(body.tracking_settings).toEqual({
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: false },
    });
  });

  it("préfère Gmail à SendGrid lorsque le compte Gmail est configuré", async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    const gmailSender = vi.fn(async () => undefined);

    await sendColleagueSharingEmail(
      "collegue@example.test",
      "Mika & équipe",
      {
        GMAIL_SMTP_USER: "expediteur@gmail.com",
        GMAIL_APP_PASSWORD: "mot-de-passe-application",
        SENDGRID_API_KEY: "sendgrid-key",
        SENDGRID_FROM_EMAIL: "expediteur@gmail.com",
        URL: "https://planning.test",
      },
      fetcher as typeof fetch,
      gmailSender,
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(gmailSender).toHaveBeenCalledWith(
      { user: "expediteur@gmail.com", appPassword: "mot-de-passe-application" },
      expect.objectContaining({
        from: "Planning Solo <expediteur@gmail.com>",
        to: "collegue@example.test",
        replyTo: "expediteur@gmail.com",
        subject: expect.stringContaining("partage son planning"),
        text: expect.stringContaining("https://planning.test"),
        html: expect.stringContaining("Mika &amp; équipe"),
      }),
    );
  });

  it("refuse une configuration Gmail partielle", async () => {
    await expect(sendColleagueSharingEmail(
      "collegue@example.test",
      "Mika",
      { GMAIL_SMTP_USER: "expediteur@gmail.com" },
    )).rejects.toThrow("configuration Gmail est incomplète");
  });

  it("réutilise l’adresse SendGrid comme identifiant Gmail", async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    const gmailSender = vi.fn(async () => undefined);

    await sendColleagueSharingEmail(
      "collegue@example.test",
      "Mika",
      {
        GMAIL_APP_PASSWORD: "mot-de-passe-application",
        SENDGRID_FROM_EMAIL: "expediteur@gmail.com",
      },
      fetcher as typeof fetch,
      gmailSender,
    );

    expect(gmailSender).toHaveBeenCalledWith(
      expect.objectContaining({ user: "expediteur@gmail.com" }),
      expect.objectContaining({ from: "Planning Solo <expediteur@gmail.com>" }),
    );
  });

  it("refuse une configuration SendGrid partielle au lieu de revenir silencieusement à Resend", async () => {
    await expect(sendColleagueSharingEmail(
      "collegue@example.test",
      "Mika",
      {
        SENDGRID_API_KEY: "sendgrid-key",
        RESEND_API_KEY: "resend-key",
        PROGRAM_ALERT_FROM: "Planning <planning@example.test>",
      },
    )).rejects.toThrow("configuration SendGrid est incomplète");
  });
});
