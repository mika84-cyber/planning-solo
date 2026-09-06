import { getStore } from "@netlify/blobs";
import { requestPasswordRecovery } from "@netlify/identity";
import { isTrustedMutation } from "../lib/requestSecurity.mts";

type RateRecord = { attemptedAt: string };
type RateStore = {
  get(key: string, options: { type: "json" }): Promise<RateRecord | null>;
  setJSON(key: string, value: RateRecord): Promise<unknown>;
};

const RECOVERY_COOLDOWN_MS = 15 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
    },
  });
}

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

async function recoveryRateKey(email: string) {
  const bytes = new TextEncoder().encode(email);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `email-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function canAttemptRecovery(email: string, now: Date, store: RateStore) {
  const key = await recoveryRateKey(email);
  const previous = await store.get(key, { type: "json" });
  const previousTime = previous?.attemptedAt ? Date.parse(previous.attemptedAt) : Number.NaN;
  if (Number.isFinite(previousTime) && now.getTime() - previousTime < RECOVERY_COOLDOWN_MS)
    return false;
  await store.setJSON(key, { attemptedAt: now.toISOString() });
  return true;
}

export default async function passwordRecoveryHandler(request: Request) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!isTrustedMutation(request))
    return json({ error: "Origine de la requête non autorisée" }, 403);

  let email = "";
  try {
    const body = await request.json() as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return json({ error: "Requête invalide" }, 400);
  }
  if (!validEmail(email)) return json({ error: "Adresse e-mail invalide" }, 400);

  const store = getStore({
    name: "planning-solo-password-recovery",
    consistency: "strong",
  }) as RateStore;
  if (!await canAttemptRecovery(email, new Date(), store)) return json({ ok: true }, 202);

  try {
    await requestPasswordRecovery(email);
  } catch (error) {
    console.warn(
      "Planning Solo: récupération de mot de passe indisponible",
      error instanceof Error ? error.message : error,
    );
  }
  return json({ ok: true }, 202);
}

export const config = { path: "/api/password-recovery" };
