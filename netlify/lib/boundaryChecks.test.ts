import { describe, expect, it } from "vitest";
import {
  checkEmailChannel,
  checkGrandPalaisSite,
  checkNotificationChannel,
  deliveryProofDue,
} from "./boundaryChecks.mts";

const credentials = {
  RESEND_API_KEY: "re_clé",
  PROGRAM_ADMIN_EMAIL: "mika@exemple.test",
  PROGRAM_ALERT_FROM: "Planning Solo <alertes@exemple.test>",
};
const gmailCredentials = {
  ...credentials,
  GMAIL_APP_PASSWORD: "mot-de-passe",
  SENDGRID_FROM_EMAIL: "compte@exemple.test",
};
const noFetch = (async () => {
  throw new Error("Aucun autre service ne doit être interrogé");
}) as typeof fetch;

describe("contrôle des frontières", () => {
  it("reconnaît un programme officiel encore lisible", async () => {
    const status = await checkGrandPalaisSite(async () => [{}, {}, {}]);
    expect(status).toMatchObject({ ok: true, detail: "3 événements lus" });
  });

  it("alerte quand le site ne rend plus aucun événement", async () => {
    // Une refonte du site ne lève aucune erreur : elle rend une liste vide.
    const status = await checkGrandPalaisSite(async () => []);
    expect(status.ok).toBe(false);
    expect(status.detail).toContain("structure du site");
  });

  it("rapporte l’échec de lecture sans le laisser remonter", async () => {
    const status = await checkGrandPalaisSite(async () => {
      throw new Error("Programme Grand Palais indisponible");
    });
    expect(status).toMatchObject({ ok: false, detail: "Programme Grand Palais indisponible" });
  });

  it("compte les appareils qui recevraient une alerte", async () => {
    const status = await checkNotificationChannel(async () => ({ devices: 2 }));
    expect(status).toMatchObject({ ok: true, detail: "2 appareils inscrits" });
  });

  it("alerte quand aucun appareil n’est inscrit", async () => {
    // Le piège : la liaison fonctionne, et pourtant personne n'est prévenu.
    const status = await checkNotificationChannel(async () => ({ devices: 0 }));
    expect(status.ok).toBe(false);
    expect(status.detail).toContain("Aucun appareil");
  });

  it("alerte quand le planning partagé ne reconnaît pas le secret", async () => {
    const status = await checkNotificationChannel(async () => null);
    expect(status.ok).toBe(false);
    expect(status.detail).toContain("secret de liaison");
  });

  it("valide une configuration e-mail complète", async () => {
    const status = await checkEmailChannel(
      async () => new Response("{}", { status: 200 }),
      credentials,
    );
    expect(status).toMatchObject({ ok: true, detail: "Clé valide" });
  });

  it("contrôle Gmail quand c’est lui qui envoie, sans interroger Resend ni rien envoyer", async () => {
    const logins: Array<{ user: string; appPassword: string }> = [];
    const status = await checkEmailChannel(noFetch, gmailCredentials, async (login) => {
      logins.push(login);
    });
    expect(status).toMatchObject({ ok: true, detail: "Gmail accepte la connexion" });
    expect(logins).toEqual([{ user: "compte@exemple.test", appPassword: "mot-de-passe" }]);
  });

  it("signale un mot de passe Gmail refusé", async () => {
    const status = await checkEmailChannel(noFetch, gmailCredentials, async () => {
      throw new Error("Invalid login");
    });
    expect(status).toMatchObject({ ok: false, detail: "Connexion à Gmail impossible : Invalid login" });
  });

  it("signale une configuration Gmail incomplète", async () => {
    const status = await checkEmailChannel(noFetch, { ...credentials, GMAIL_APP_PASSWORD: "mot-de-passe" });
    expect(status).toMatchObject({ ok: false, detail: "La configuration Gmail est incomplète" });
  });

  it("interroge SendGrid quand c’est lui qui envoie", async () => {
    const urls: string[] = [];
    const status = await checkEmailChannel(
      (async (url: string) => {
        urls.push(url);
        return new Response("{}", { status: 403 });
      }) as typeof fetch,
      { ...credentials, SENDGRID_API_KEY: "sg_clé", SENDGRID_FROM_EMAIL: "compte@exemple.test" },
    );
    expect(urls).toEqual(["https://api.sendgrid.com/v3/scopes"]);
    expect(status).toMatchObject({ ok: false, detail: "Clé refusée par SendGrid (403)" });
  });

  it("dit ce qui manque", async () => {
    const withoutRecipient = await checkEmailChannel(noFetch, { ...gmailCredentials, PROGRAM_ADMIN_EMAIL: "" });
    expect(withoutRecipient).toMatchObject({ ok: false, detail: "Configuration incomplète : PROGRAM_ADMIN_EMAIL" });
    const withoutSender = await checkEmailChannel(noFetch, { ...credentials, RESEND_API_KEY: "" });
    expect(withoutSender).toMatchObject({ ok: false, detail: "La configuration d’envoi d’e-mail est incomplète" });
  });

  it("signale une clé refusée", async () => {
    const status = await checkEmailChannel(
      async () => new Response("{}", { status: 401 }),
      credentials,
    );
    expect(status).toMatchObject({ ok: false, detail: "Clé refusée par Resend (401)" });
  });

  it("signale l’expéditeur de démonstration sans crier à la panne", async () => {
    // Il fonctionne, mais ne livre qu'au titulaire du compte : à savoir,
    // pas à corriger en urgence.
    const status = await checkEmailChannel(
      async () => new Response("{}", { status: 200 }),
      { ...credentials, PROGRAM_ALERT_FROM: "Planning Solo <onboarding@resend.dev>" },
    );
    expect(status.ok).toBe(true);
    expect(status.detail).toContain("titulaire du compte");
  });

  it("réclame un envoi réel au premier contrôle puis chaque mois", () => {
    expect(deliveryProofDue(null, "2026-09-14T00:05:00.000Z")).toBe(true);
    const septembre = {
      checkedAt: "2026-09-07T00:05:00.000Z",
      boundaries: [],
      lastDeliveryAt: "2026-09-07T00:05:00.000Z",
    };
    expect(deliveryProofDue(septembre, "2026-09-14T00:05:00.000Z")).toBe(false);
    expect(deliveryProofDue(septembre, "2026-10-05T00:05:00.000Z")).toBe(true);
  });
});
