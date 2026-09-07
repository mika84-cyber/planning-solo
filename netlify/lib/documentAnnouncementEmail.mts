import { sendGmailEmail, type GmailSender } from "./gmailEmail.mts";

type EmailEnvironment = Record<string, string | undefined>;

function runtimeEnv(): EmailEnvironment {
  const env = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify?.env;
  return {
    GMAIL_SMTP_USER: env?.get("GMAIL_SMTP_USER"),
    GMAIL_APP_PASSWORD: env?.get("GMAIL_APP_PASSWORD"),
    SENDGRID_API_KEY: env?.get("SENDGRID_API_KEY"),
    SENDGRID_FROM_EMAIL: env?.get("SENDGRID_FROM_EMAIL"),
    RESEND_API_KEY: env?.get("RESEND_API_KEY"),
    PROGRAM_ALERT_FROM: env?.get("PROGRAM_ALERT_FROM"),
    URL: env?.get("URL"),
  };
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character] || character);
}

export async function sendDocumentAnnouncementEmail(
  recipientEmail: string,
  documentTitle: string,
  folderTitle: string,
  env: EmailEnvironment = runtimeEnv(),
  fetcher: typeof fetch = fetch,
  gmailSender: GmailSender = sendGmailEmail,
) {
  const gmailUser = env.GMAIL_SMTP_USER || (env.GMAIL_APP_PASSWORD ? env.SENDGRID_FROM_EMAIL : undefined);
  const hasGmailConfiguration = Boolean(env.GMAIL_SMTP_USER || env.GMAIL_APP_PASSWORD);
  const useGmail = Boolean(gmailUser && env.GMAIL_APP_PASSWORD);
  if (hasGmailConfiguration && !useGmail) throw new Error("La configuration Gmail est incomplète");
  const hasSendGridConfiguration = Boolean(env.SENDGRID_API_KEY || env.SENDGRID_FROM_EMAIL);
  const useSendGrid = Boolean(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL);
  if (!useGmail && hasSendGridConfiguration && !useSendGrid)
    throw new Error("La configuration SendGrid est incomplète");
  if (!useGmail && !useSendGrid && (!env.RESEND_API_KEY || !env.PROGRAM_ALERT_FROM))
    throw new Error("La configuration d’envoi d’e-mail est incomplète");

  const siteUrl = `${(env.URL || "https://planning-solo.netlify.app").replace(/\/$/, "")}/?section=forms`;
  const safeTitle = escapeHtml(documentTitle);
  const safeFolder = escapeHtml(folderTitle);
  const subject = `Planning Solo — Nouveau document : ${documentTitle}`;
  const text = `Un nouveau document est disponible dans Planning Solo.\n\n${documentTitle}\nRubrique : ${folderTitle}\n\nOuvrir les documents : ${siteUrl}`;
  const html = `<p>Un nouveau document est disponible dans <strong>Planning Solo</strong>.</p><p><strong>${safeTitle}</strong><br>Rubrique : ${safeFolder}</p><p><a href="${siteUrl}">Ouvrir les documents</a></p>`;

  if (useGmail) {
    const sender = gmailUser as string;
    await gmailSender(
      { user: sender, appPassword: env.GMAIL_APP_PASSWORD as string },
      { from: `Planning Solo <${sender}>`, to: recipientEmail, replyTo: sender, subject, text, html },
    );
    return true;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await fetcher(useSendGrid ? "https://api.sendgrid.com/v3/mail/send" : "https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${useSendGrid ? env.SENDGRID_API_KEY : env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(useSendGrid ? {
      personalizations: [{ to: [{ email: recipientEmail }] }],
      from: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      reply_to: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      subject,
      content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }],
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } },
    } : { from: env.PROGRAM_ALERT_FROM, to: [recipientEmail], subject, text, html }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Envoi de l’alerte document impossible (${response.status})`);
  return true;
}
