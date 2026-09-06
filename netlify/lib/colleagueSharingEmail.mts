import { sendGmailEmail, type GmailSender } from "./gmailEmail.mts";

type EmailEnvironment = Record<string, string | undefined>;

function runtimeEnv(): EmailEnvironment {
  const netlifyEnv = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify?.env;
  return {
    GMAIL_SMTP_USER: netlifyEnv?.get("GMAIL_SMTP_USER"),
    GMAIL_APP_PASSWORD: netlifyEnv?.get("GMAIL_APP_PASSWORD"),
    SENDGRID_API_KEY: netlifyEnv?.get("SENDGRID_API_KEY"),
    SENDGRID_FROM_EMAIL: netlifyEnv?.get("SENDGRID_FROM_EMAIL"),
    RESEND_API_KEY: netlifyEnv?.get("RESEND_API_KEY"),
    PROGRAM_ALERT_FROM: netlifyEnv?.get("PROGRAM_ALERT_FROM"),
    URL: netlifyEnv?.get("URL"),
  };
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] || character);
}

export async function sendColleagueSharingEmail(
  recipientEmail: string,
  ownerName: string,
  env: EmailEnvironment = runtimeEnv(),
  fetcher: typeof fetch = fetch,
  gmailSender: GmailSender = sendGmailEmail,
) {
  const gmailUser = env.GMAIL_SMTP_USER || (env.GMAIL_APP_PASSWORD ? env.SENDGRID_FROM_EMAIL : undefined);
  const hasGmailConfiguration = Boolean(env.GMAIL_SMTP_USER || env.GMAIL_APP_PASSWORD);
  const useGmail = Boolean(gmailUser && env.GMAIL_APP_PASSWORD);
  if (hasGmailConfiguration && !useGmail)
    throw new Error("La configuration Gmail est incomplète");
  const hasSendGridConfiguration = Boolean(env.SENDGRID_API_KEY || env.SENDGRID_FROM_EMAIL);
  const useSendGrid = Boolean(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL);
  if (!useGmail && hasSendGridConfiguration && !useSendGrid)
    throw new Error("La configuration SendGrid est incomplète");
  if (!useGmail && !useSendGrid && (!env.RESEND_API_KEY || !env.PROGRAM_ALERT_FROM))
    throw new Error("La configuration d’envoi d’e-mail est incomplète");
  const siteUrl = (env.URL || "https://planning-solo.netlify.app").replace(/\/$/, "");
  const safeName = escapeHtml(ownerName);
  const subject = `Planning Solo — ${ownerName} partage son planning avec vous`;
  const plainText = `${ownerName} partage son planning de présence et d’absence avec vous.\n\nOuvrez Planning Solo pour accepter ou refuser : ${siteUrl}\n\nLes motifs d’absence et les informations personnelles ne sont pas transmis.`;
  const html = `<p><strong>${safeName}</strong> partage son planning de présence et d’absence avec vous.</p><p><a href="${siteUrl}">Ouvrir Planning Solo pour accepter ou refuser</a></p><p>Les motifs d’absence et les informations personnelles ne sont pas transmis.</p>`;
  if (useGmail) {
    const authenticatedGmailUser = gmailUser as string;
    await gmailSender(
      { user: authenticatedGmailUser, appPassword: env.GMAIL_APP_PASSWORD as string },
      {
        from: `Planning Solo <${authenticatedGmailUser}>`,
        to: recipientEmail,
        replyTo: authenticatedGmailUser,
        subject,
        text: plainText,
        html,
      },
    );
    return true;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await fetcher(useSendGrid ? "https://api.sendgrid.com/v3/mail/send" : "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${useSendGrid ? env.SENDGRID_API_KEY : env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(useSendGrid ? {
      personalizations: [{ to: [{ email: recipientEmail }] }],
      from: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      reply_to: { email: env.SENDGRID_FROM_EMAIL, name: "Planning Solo" },
      subject,
      content: [
        { type: "text/plain", value: plainText },
        { type: "text/html", value: html },
      ],
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
        subscription_tracking: { enable: false },
      },
    } : {
      from: env.PROGRAM_ALERT_FROM,
      to: [recipientEmail],
      subject,
      text: plainText,
      html,
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Envoi de l’e-mail de partage impossible (${response.status})`);
  return true;
}
