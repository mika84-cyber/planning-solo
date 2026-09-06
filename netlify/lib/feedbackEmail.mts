import { sendGmailEmail, type GmailSender } from "./gmailEmail.mts";

export type FeedbackKind = "idea" | "suggestion" | "bug";
type EmailEnvironment = Record<string, string | undefined>;

function runtimeEnv(): EmailEnvironment {
  const netlifyEnv = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify?.env;
  return {
    PROGRAM_ADMIN_EMAIL: netlifyEnv?.get("PROGRAM_ADMIN_EMAIL"),
    GMAIL_SMTP_USER: netlifyEnv?.get("GMAIL_SMTP_USER"),
    GMAIL_APP_PASSWORD: netlifyEnv?.get("GMAIL_APP_PASSWORD"),
    SENDGRID_API_KEY: netlifyEnv?.get("SENDGRID_API_KEY"),
    SENDGRID_FROM_EMAIL: netlifyEnv?.get("SENDGRID_FROM_EMAIL"),
    RESEND_API_KEY: netlifyEnv?.get("RESEND_API_KEY"),
    PROGRAM_ALERT_FROM: netlifyEnv?.get("PROGRAM_ALERT_FROM"),
    URL: netlifyEnv?.get("URL"),
  };
}

const KIND_LABELS: Record<FeedbackKind, string> = {
  idea: "idée",
  suggestion: "suggestion",
  bug: "signalement de bug",
};

export async function sendFeedbackAlert(
  kind: FeedbackKind,
  env: EmailEnvironment = runtimeEnv(),
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

  const siteUrl = `${(env.URL || "https://planning-solo.netlify.app").replace(/\/$/, "")}/?feedback=inbox`;
  const subject = "Planning Solo — Nouveau message reçu";
  const plainText = `Une nouvelle ${KIND_LABELS[kind]} est arrivée dans ta messagerie privée Planning Solo.\n\nOuvrir la messagerie : ${siteUrl}\n\nLe contenu du message et sa photo restent uniquement dans l’application.`;
  const html = `<p>Une nouvelle <strong>${KIND_LABELS[kind]}</strong> est arrivée dans ta messagerie privée Planning Solo.</p><p><a href="${siteUrl}">Ouvrir la messagerie</a></p><p>Le contenu du message et sa photo restent uniquement dans l’application.</p>`;

  if (useGmail) {
    const authenticatedGmailUser = gmailUser as string;
    await gmailSender(
      { user: authenticatedGmailUser, appPassword: env.GMAIL_APP_PASSWORD as string },
      { from: `Planning Solo <${authenticatedGmailUser}>`, to: recipient, replyTo: authenticatedGmailUser, subject, text: plainText, html },
    );
    return true;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await fetcher(useSendGrid ? "https://api.sendgrid.com/v3/mail/send" : "https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${useSendGrid ? env.SENDGRID_API_KEY : env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(useSendGrid ? {
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      reply_to: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      subject,
      content: [{ type: "text/plain", value: plainText }, { type: "text/html", value: html }],
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } },
    } : { from: env.PROGRAM_ALERT_FROM, to: [recipient], subject, text: plainText, html }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Envoi de l’alerte impossible (${response.status})`);
  return true;
}
