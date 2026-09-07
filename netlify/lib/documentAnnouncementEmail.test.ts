import { describe, expect, it, vi } from "vitest";
import { sendDocumentAnnouncementEmail } from "./documentAnnouncementEmail.mts";

describe("e-mail de nouveau document", () => {
  it("envoie un message Gmail individuel avec un lien vers les formulaires", async () => {
    const gmailSender = vi.fn(async () => undefined);
    await sendDocumentAnnouncementEmail(
      "invite@example.test",
      "Consignes <Expo>",
      "Formulaire Expo",
      { GMAIL_SMTP_USER: "sender@example.test", GMAIL_APP_PASSWORD: "secret", URL: "https://planning.example.test" },
      fetch,
      gmailSender,
    );
    expect(gmailSender).toHaveBeenCalledWith(
      { user: "sender@example.test", appPassword: "secret" },
      expect.objectContaining({
        to: "invite@example.test",
        subject: "Planning Solo — Nouveau document : Consignes <Expo>",
        text: expect.stringContaining("https://planning.example.test/?section=forms"),
        html: expect.stringContaining("Consignes &lt;Expo&gt;"),
      }),
    );
  });

  it("refuse une configuration d’envoi incomplète", async () => {
    await expect(sendDocumentAnnouncementEmail("invite@example.test", "Document", "Expo", {})).rejects.toThrow("incomplète");
  });
});
