import { describe, expect, it, vi } from "vitest";
import { sendFeedbackAlert } from "./feedbackEmail.mts";

describe("alerte de la messagerie interne", () => {
  it("prévient uniquement l’administrateur sans inclure le contenu du message", async () => {
    const gmailSender = vi.fn(async () => undefined);
    await sendFeedbackAlert(
      "bug",
      {
        PROGRAM_ADMIN_EMAIL: "admin@example.test",
        GMAIL_SMTP_USER: "sender@gmail.test",
        GMAIL_APP_PASSWORD: "secret",
        URL: "https://planning.example.test",
      },
      fetch,
      gmailSender,
    );
    expect(gmailSender).toHaveBeenCalledWith(
      { user: "sender@gmail.test", appPassword: "secret" },
      expect.objectContaining({
        to: "admin@example.test",
        subject: "Planning Solo — Nouveau message reçu",
        text: expect.stringContaining("https://planning.example.test/?feedback=inbox"),
      }),
    );
    expect(JSON.stringify(gmailSender.mock.calls)).not.toContain("contenu secret");
  });
});
