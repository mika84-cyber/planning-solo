import { getStore } from "@netlify/blobs";
import { emailEnvironment, sendAdminEmail } from "./adminEmail.mts";
import { sendGmailEmail, type GmailSender } from "./gmailEmail.mts";

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

export function shouldSendGuestLoginAlert(
  connectedEmail: string | undefined,
  administratorEmail: string | undefined,
) {
  const connected = normalizedEmail(connectedEmail);
  const administrator = normalizedEmail(administratorEmail);
  return Boolean(connected && administrator && connected !== administrator);
}

function escapeHtml(value: string) {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(
    /[&<>"']/g,
    (character) => htmlEntities[character] ?? character,
  );
}

function formatLoginDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** Prévient le compte administrateur, par le même moyen d'envoi que ses
 *  autres alertes (adminEmail : Gmail, puis SendGrid, puis Resend). */
export async function sendGuestLoginAlert(
  connectedEmail: string | undefined,
  connectedAt = new Date(),
  env: LoginAlertEnvironment = emailEnvironment(),
  fetcher: typeof fetch = fetch,
  gmailSender: GmailSender = sendGmailEmail,
) {
  if (!shouldSendGuestLoginAlert(connectedEmail, env.PROGRAM_ADMIN_EMAIL)) return false;
  const guestEmail = normalizedEmail(connectedEmail);
  const displayedDate = formatLoginDate(connectedAt);
  return sendAdminEmail({
    subject: "Connexion d’un compte invité sur Planning Solo",
    text: `Un compte invité vient de se connecter à Planning Solo.\n\nCompte : ${guestEmail}\nDate : ${displayedDate}\n\nCette alerte est réservée au compte administrateur.`,
    html: [
      "<p>Un compte invité vient de se connecter à Planning Solo.</p>",
      `<p><strong>Compte :</strong> ${escapeHtml(guestEmail)}<br>`,
      `<strong>Date :</strong> ${escapeHtml(displayedDate)}</p>`,
      "<p>Cette alerte est réservée au compte administrateur.</p>",
    ].join(""),
  }, env, fetcher, gmailSender);
}

export async function sendGuestLoginAlertOnce(
  userId: string,
  connectedEmail: string | undefined,
  connectedAt = new Date(),
  env: LoginAlertEnvironment = emailEnvironment(),
  fetcher: typeof fetch = fetch,
  store: LoginAlertStore = getStore({
    name: "planning-solo-login-alerts",
    consistency: "strong",
  }) as LoginAlertStore,
  gmailSender: GmailSender = sendGmailEmail,
): Promise<GuestLoginAlertStatus> {
  if (!shouldSendGuestLoginAlert(connectedEmail, env.PROGRAM_ADMIN_EMAIL))
    return "administrator";

  const key = `user-${userId}`;
  const previous = await store.get(key, { type: "json" });
  const previousTime = previous?.sentAt ? Date.parse(previous.sentAt) : Number.NaN;
  if (Number.isFinite(previousTime) && connectedAt.getTime() - previousTime < ALERT_THROTTLE_MS)
    return "throttled";

  await sendGuestLoginAlert(connectedEmail, connectedAt, env, fetcher, gmailSender);
  await store.setJSON(key, { sentAt: connectedAt.toISOString() });
  return "sent";
}
