import { describe, expect, it } from "vitest";
import {
  checkEmailChannel,
  checkGrandPalaisSite,
  checkNotificationChannel,
  deliveryProofDue,
} from "./boundaryChecks.mts";

const credentials = {
  apiKey: "re_clé",
  recipient: "mika@exemple.test",
  from: "Planning Solo <alertes@exemple.test>",
};

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

  it("nomme les variables manquantes", async () => {
    const status = await checkEmailChannel(
      async () => new Response("{}", { status: 200 }),
      { apiKey: "", recipient: "", from: credentials.from },
    );
    expect(status.ok).toBe(false);
    expect(status.detail).toContain("RESEND_API_KEY");
    expect(status.detail).toContain("PROGRAM_ADMIN_EMAIL");
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
      { ...credentials, from: "Planning Solo <onboarding@resend.dev>" },
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
