import { getStore } from "@netlify/blobs";

type LoginAlertEnvironment = Record<string, string | undefined>;

type LoginAlertRecord = { sentAt: string };

type LoginAlertStore = {
  get(key: string, options: { type: "json" }): Promise<LoginAlertRecord | null>;
  setJSON(key: string, value: LoginAlertRecord): Promise<unknown>;
};

export type GuestLoginAlertStatus = "sent" | "administrator" | "throttled";

const ALERT_THROTTLE_MS = 30 * 60 * 1000;

function normalizedEmail(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function runtimeEnv(): LoginAlertEnvironment {
  const netlifyEnv = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify?.env;
  return {
    PROGRAM_ADMIN_EMAIL: netlifyEnv?.get("PROGRAM_ADMIN_EMAIL"),
    PROGRAM_ALERT_FROM: netlifyEnv?.get("PROGRAM_ALERT_FROM"),
    RESEND_API_KEY: netlifyEnv?.get("RESEND_API_KEY"),
  };
}

export function shouldSendGuestLoginAlert(
  connectedEmail: string | undefined,
  administratorEmail: string | undefined,
) {
  const connected = normalizedEmail(connectedEmail);
  const administrator = normalizedEmail(administratorEmail);
  return Boolean(connected && administrator && connected !== administrator);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function formatLoginDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

export async function sendGuestLoginAlert(
  connectedEmail: string | undefined,
  connectedAt = new Date(),
  env: LoginAlertEnvironment = runtimeEnv(),
  fetcher: typeof fetch = fetch,
) {
  const administratorEmail = env.PROGRAM_ADMIN_EMAIL;
  if (!shouldSendGuestLoginAlert(connectedEmail, administratorEmail)) return false;
  if (!env.RESEND_API_KEY || !env.PROGRAM_ALERT_FROM)
    throw new Error("Les variables d’alerte e-mail de Planning Solo sont incomplètes");

  const guestEmail = normalizedEmail(connectedEmail);
  const displayedDate = formatLoginDate(connectedAt);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.PROGRAM_ALERT_FROM,
      to: [administratorEmail],
      subject: "Connexion d’un compte invité sur Planning Solo",
      html: [
        "<p>Un compte invité vient de se connecter à Planning Solo.</p>",
        `<p><strong>Compte :</strong> ${escapeHtml(guestEmail)}<br>`,
        `<strong>Date :</strong> ${escapeHtml(displayedDate)}</p>`,
        "<p>Cette alerte est réservée au compte administrateur.</p>",
      ].join(""),
    }),
  });
  if (!response.ok) throw new Error(`Envoi de l’alerte de connexion impossible (${response.status})`);
  return true;
}


export async function sendGuestLoginAlertOnce(
  userId: string,
  connectedEmail: string | undefined,
  connectedAt = new Date(),
  env: LoginAlertEnvironment = runtimeEnv(),
  fetcher: typeof fetch = fetch,
  store: LoginAlertStore = getStore({
    name: "planning-solo-login-alerts",
    consistency: "strong",
  }) as LoginAlertStore,
): Promise<GuestLoginAlertStatus> {
  if (!shouldSendGuestLoginAlert(connectedEmail, env.PROGRAM_ADMIN_EMAIL))
    return "administrator";

  const key = `user-${userId}`;
  const previous = await store.get(key, { type: "json" });
  const previousTime = previous?.sentAt ? Date.parse(previous.sentAt) : Number.NaN;
  if (Number.isFinite(previousTime) && connectedAt.getTime() - previousTime < ALERT_THROTTLE_MS)
    return "throttled";

  await sendGuestLoginAlert(connectedEmail, connectedAt, env, fetcher);
  await store.setJSON(key, { sentAt: connectedAt.toISOString() });
  return "sent";
}
