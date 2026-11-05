import { emailEnvironment, sendAdminEmail, type EmailEnvironment } from "./adminEmail.mts";
import { sendGmailEmail, type GmailSender } from "./gmailEmail.mts";

export type FeedbackKind = "idea" | "suggestion" | "bug";

const KIND_LABELS: Record<FeedbackKind, string> = {
  idea: "idée",
  suggestion: "suggestion",
  bug: "signalement de bug",
};

export async function sendFeedbackAlert(
  kind: FeedbackKind,
  env: EmailEnvironment = emailEnvironment(),
  fetcher: typeof fetch = fetch,
  gmailSender: GmailSender = sendGmailEmail,
) {
  const siteUrl = `${(env.URL || "https://planning-solo.netlify.app").replace(/\/$/, "")}/?feedback=inbox`;
  return sendAdminEmail({
    subject: "Planning Solo — Nouveau message reçu",
    text: `Une nouvelle ${KIND_LABELS[kind]} est arrivée dans ta messagerie privée Planning Solo.\n\nOuvrir la messagerie : ${siteUrl}\n\nLe contenu du message et sa photo restent uniquement dans l’application.`,
    html: `<p>Une nouvelle <strong>${KIND_LABELS[kind]}</strong> est arrivée dans ta messagerie privée Planning Solo.</p><p><a href="${siteUrl}">Ouvrir la messagerie</a></p><p>Le contenu du message et sa photo restent uniquement dans l’application.</p>`,
  }, env, fetcher, gmailSender);
}
