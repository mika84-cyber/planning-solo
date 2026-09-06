import type { GmailSender } from "./gmailEmail.mts";
import { sendGmailEmail } from "./gmailEmail.mts";

type RecoveryEnvironment = Record<string, string | undefined>;

export type RecoveryIdentityUser = {
  email?: string | null;
  confirmedAt?: string | null;
  invitedAt?: string | null;
};

export type RecoveryIdentityAdmin = {
  listUsers(options: { page: number; perPage: number }): Promise<RecoveryIdentityUser[]>;
};

export type RecoveryAction = "recovery" | "invite";

export type RecoveryIdentityConfig = { url: string; token?: string };

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] || character);
}

function runtimeEnv(): RecoveryEnvironment {
  const netlifyEnv = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify?.env;
  return {
    GMAIL_SMTP_USER: netlifyEnv?.get("GMAIL_SMTP_USER"),
    GMAIL_APP_PASSWORD: netlifyEnv?.get("GMAIL_APP_PASSWORD"),
    SENDGRID_FROM_EMAIL: netlifyEnv?.get("SENDGRID_FROM_EMAIL"),
    URL: netlifyEnv?.get("URL"),
  };
}

export async function findRecoveryUser(email: string, identityAdmin: RecoveryIdentityAdmin) {
  const target = normalizedEmail(email);
  for (let page = 1; page <= 100; page += 1) {
    const users = await identityAdmin.listUsers({ page, perPage: 100 });
    const user = users.find((candidate) => normalizedEmail(candidate.email || "") === target);
    if (user) return user;
    if (users.length < 100) return null;
  }
  return null;
}

export function recoveryActionForUser(user: RecoveryIdentityUser): RecoveryAction {
  return user.confirmedAt ? "recovery" : "invite";
}

export async function createIdentityActionLink(
  email: string,
  action: RecoveryAction,
  identityConfig: RecoveryIdentityConfig | null,
  siteUrl: string,
  fetcher: typeof fetch = fetch,
) {
  if (!identityConfig?.url || !identityConfig.token)
    throw new Error("La configuration administrateur Identity est indisponible");
  const response = await fetcher(`${identityConfig.url.replace(/\/$/, "")}/admin/generate_link`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${identityConfig.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: action, email, redirect_to: siteUrl }),
  });
  if (!response.ok)
    throw new Error(`La création du lien de récupération a échoué (${response.status})`);
  const payload = await response.json() as { action_link?: unknown };
  if (typeof payload.action_link !== "string" || !payload.action_link.startsWith("https://"))
    throw new Error("Le lien de récupération renvoyé par Identity est invalide");
  return payload.action_link;
}

export async function sendPasswordRecoveryEmail(
  recipientEmail: string,
  action: RecoveryAction,
  actionLink: string,
  env: RecoveryEnvironment = runtimeEnv(),
  gmailSender: GmailSender = sendGmailEmail,
) {
  const gmailUser = env.GMAIL_SMTP_USER || env.SENDGRID_FROM_EMAIL;
  if (!gmailUser || !env.GMAIL_APP_PASSWORD)
    throw new Error("La configuration Gmail de récupération est incomplète");
  const isActivation = action === "invite";
  const subject = isActivation
    ? "Planning Solo — activer votre accès"
    : "Planning Solo — réinitialiser votre mot de passe";
  const instruction = isActivation
    ? "Une invitation existe pour cette adresse. Utilisez le lien ci-dessous pour activer votre accès et choisir votre mot de passe."
    : "Une demande de nouveau mot de passe a été effectuée pour cette adresse.";
  const buttonLabel = isActivation ? "Activer mon accès" : "Choisir un nouveau mot de passe";
  const text = `${instruction}\n\n${buttonLabel} : ${actionLink}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.`;
  const html = `<p>${escapeHtml(instruction)}</p><p><a href="${escapeHtml(actionLink)}">${buttonLabel}</a></p><p>Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.</p>`;
  await gmailSender(
    { user: gmailUser, appPassword: env.GMAIL_APP_PASSWORD },
    {
      from: `Planning Solo <${gmailUser}>`,
      to: recipientEmail,
      replyTo: gmailUser,
      subject,
      text,
      html,
    },
  );
}
