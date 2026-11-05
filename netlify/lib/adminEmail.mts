import { sendGmailEmail, type GmailSender } from "./gmailEmail.mts";

/* Les alertes adressées au compte administrateur (messagerie, connexion d'un
   invité) partent par le premier moyen configuré : Gmail, puis SendGrid,
   puis Resend. Un seul chemin pour toutes : une alerte ne reste plus sur un
   ancien moyen d'envoi quand les autres en ont changé. */

export type EmailEnvironment = Record<string, string | undefined>;
export type AdminMessage = { subject: string; text: string; html: string };

const SEND_TIMEOUT_MS = 10_000;

/** Les variables d'envoi, lues à l'exécution de la fonction. */
export function emailEnvironment(): EmailEnvironment {
  const netlifyEnv = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify?.env;
  const names = [
    "PROGRAM_ADMIN_EMAIL",
    "GMAIL_SMTP_USER",
    "GMAIL_APP_PASSWORD",
    "SENDGRID_API_KEY",
    "SENDGRID_FROM_EMAIL",
    "RESEND_API_KEY",
    "PROGRAM_ALERT_FROM",
    "URL",
  ];
  return Object.fromEntries(names.map((name) => [name, netlifyEnv?.get(name)]));
}

/** Envoie un message au compte administrateur. */
export async function sendAdminEmail(
  message: AdminMessage,
  env: EmailEnvironment = emailEnvironment(),
  fetcher: typeof fetch = fetch,
  gmailSender: GmailSender = sendGmailEmail,
) {
  const recipient = env.PROGRAM_ADMIN_EMAIL;
  if (!recipient) throw new Error("Le destinataire des alertes n’est pas configuré");
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

  const { subject, text, html } = message;
  if (useGmail) {
    const authenticatedGmailUser = gmailUser as string;
    await gmailSender(
      { user: authenticatedGmailUser, appPassword: env.GMAIL_APP_PASSWORD as string },
      { from: `Planning Solo <${authenticatedGmailUser}>`, to: recipient, replyTo: authenticatedGmailUser, subject, text, html },
    );
    return true;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  const response = await fetcher(useSendGrid ? "https://api.sendgrid.com/v3/mail/send" : "https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${useSendGrid ? env.SENDGRID_API_KEY : env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(useSendGrid ? {
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      reply_to: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      subject,
      content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }],
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } },
    } : { from: env.PROGRAM_ALERT_FROM, to: [recipient], subject, text, html }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Envoi de l’alerte impossible (${response.status})`);
  return true;
}
