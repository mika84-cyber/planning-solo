import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stored = new Map<string, unknown>();
const store = {
  get: vi.fn(async (key: string) => stored.get(key) ?? null),
  setJSON: vi.fn(async (key: string, value: unknown) => { stored.set(key, value); }),
};

vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));
vi.mock("../lib/grandPalaisMonitor.mts", () => ({ collectGrandPalaisEvents: vi.fn(async () => [{}]) }));
vi.mock("../lib/sharedCalendarBridge.mts", () => ({
  checkSharedNotificationChannel: vi.fn(async () => ({ devices: 1 })),
  sendSharedPlanningNotification: vi.fn(async () => true),
}));
vi.mock("../lib/gmailEmail.mts", () => ({
  sendGmailEmail: vi.fn(async () => {}),
  verifyGmailLogin: vi.fn(async () => {}),
}));

import checkBoundaries from "../functions/boundary-check.mts";
import { sendGmailEmail, verifyGmailLogin } from "../lib/gmailEmail.mts";

const mockedSend = vi.mocked(sendGmailEmail);
const mockedVerify = vi.mocked(verifyGmailLogin);
const noFetch = vi.fn(async () => { throw new Error("Resend ne doit pas être interrogé"); });

/** Lundi, 0 h 10 à Paris : le seul moment où le contrôle travaille. */
const MONDAY_MIDNIGHT = "2026-11-08T23:10:00Z";

const environment: Record<string, string> = {
  PROGRAM_ADMIN_EMAIL: "admin@example.test",
  GMAIL_APP_PASSWORD: "mot-de-passe",
  SENDGRID_FROM_EMAIL: "compte@example.test",
  // Toujours configuré en production, mais rien n'en arrive (expéditeur d'essai).
  RESEND_API_KEY: "cle",
  PROGRAM_ALERT_FROM: "essai@resend.dev",
};

describe("contrôle hebdomadaire des alertes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY_MIDNIGHT));
    stored.clear();
    mockedSend.mockReset();
    mockedVerify.mockReset();
    noFetch.mockClear();
    vi.stubGlobal("Netlify", { env: { get: (name: string) => environment[name] } });
    vi.stubGlobal("fetch", noFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sans contrôle précédent, prouve la livraison par Gmail et le note dans le rapport", async () => {
    const report = await (await checkBoundaries()).json();
    expect(mockedSend).toHaveBeenCalledTimes(1);
    const [login, message] = mockedSend.mock.calls[0];
    expect(login).toEqual({ user: "compte@example.test", appPassword: "mot-de-passe" });
    expect(message).toMatchObject({
      to: "admin@example.test",
      subject: "Planning Solo — contrôle mensuel des alertes (9 novembre 2026)",
    });
    expect(message.text).toContain("il prouve simplement que les alertes");
    expect(message.html).toContain("<p>Contrôle du 9 novembre 2026.</p>");
    expect(noFetch).not.toHaveBeenCalled();
    expect(report.deliveryDetail).toBe("notification envoyée · e-mail envoyé");
    expect(report.boundaries).toContainEqual({ name: "Alerte par e-mail", ok: true, detail: "Gmail accepte la connexion" });
    expect(stored.get("health")).toEqual(report);
  });

  it("ne renvoie pas de preuve le même mois, mais contrôle toujours la connexion", async () => {
    const lastDeliveryAt = "2026-11-01T23:10:00.000Z";
    stored.set("health", { checkedAt: lastDeliveryAt, boundaries: [], lastDeliveryAt, deliveryDetail: "e-mail envoyé" });
    const report = await (await checkBoundaries()).json();
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedVerify).toHaveBeenCalledTimes(1);
    expect(report.lastDeliveryAt).toBe(lastDeliveryAt);
  });

  it("note l’échec d’envoi au lieu de le taire", async () => {
    mockedSend.mockRejectedValue(new Error("Invalid login"));
    const report = await (await checkBoundaries()).json();
    expect(report.deliveryDetail).toBe("notification envoyée · e-mail en échec (Invalid login)");
  });

  it("ne fait rien en dehors du lundi à minuit", async () => {
    vi.setSystemTime(new Date("2026-11-09T10:00:00Z"));
    const report = await (await checkBoundaries()).json();
    expect(report).toEqual({ ok: true, skipped: true });
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedVerify).not.toHaveBeenCalled();
    expect(stored.has("health")).toBe(false);
  });
});
