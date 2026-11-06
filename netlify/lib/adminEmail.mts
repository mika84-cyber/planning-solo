import { sendGmailEmail, type GmailSender } from "./gmailEmail.mts";

/* Les alertes adressées au compte administrateur (messagerie, connexion d'un
   invité, veille du Grand Palais, contrôle mensuel) partent par le premier
   moyen configuré : Gmail, puis SendGrid, puis Resend. Un seul chemin pour
   toutes : une alerte ne reste plus sur un ancien moyen d'envoi quand les
   autres en ont changé. */

export type EmailEnvironment = Record<string, string | undefined>;
export type AdminMessage = { subject: string; text: string; html: string };
export type AdminEmailChannel =
  | { kind: "gmail"; user: string; appPassword: string }
  | { kind: "sendgrid" | "resend"; apiKey: string; from: string };

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

/** Le moyen d'envoi retenu. Une configuration commencée mais incomplète
 *  s'arrête ici, sans passer au moyen suivant. */
export function adminEmailChannel(env: EmailEnvironment): AdminEmailChannel {
  if (env.GMAIL_SMTP_USER || env.GMAIL_APP_PASSWORD) {
    const user = env.GMAIL_SMTP_USER || env.SENDGRID_FROM_EMAIL;
    if (!user || !env.GMAIL_APP_PASSWORD) throw new Error("La configuration Gmail est incomplète");
    return { kind: "gmail", user, appPassword: env.GMAIL_APP_PASSWORD };
  }
  if (env.SENDGRID_API_KEY || env.SENDGRID_FROM_EMAIL) {
    if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) throw new Error("La configuration SendGrid est incomplète");
    return { kind: "sendgrid", apiKey: env.SENDGRID_API_KEY, from: env.SENDGRID_FROM_EMAIL };
  }
  if (!env.RESEND_API_KEY || !env.PROGRAM_ALERT_FROM) throw new Error("La configuration d’envoi d’e-mail est incomplète");
  return { kind: "resend", apiKey: env.RESEND_API_KEY, from: env.PROGRAM_ALERT_FROM };
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
  const channel = adminEmailChannel(env);

  const { subject, text, html } = message;
  if (channel.kind === "gmail") {
    await gmailSender(
      { user: channel.user, appPassword: channel.appPassword },
      { from: `Planning Solo <${channel.user}>`, to: recipient, replyTo: channel.user, subject, text, html },
    );
    return true;
  }
  const useSendGrid = channel.kind === "sendgrid";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  const response = await fetcher(useSendGrid ? "https://api.sendgrid.com/v3/mail/send" : "https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${channel.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(useSendGrid ? {
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: channel.from, name: "Planning Solo" },
      reply_to: { email: channel.from, name: "Planning Solo" },
      subject,
      content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }],
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } },
    } : { from: channel.from, to: [recipient], subject, text, html }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Envoi de l’alerte impossible (${response.status})`);
  return true;
}
