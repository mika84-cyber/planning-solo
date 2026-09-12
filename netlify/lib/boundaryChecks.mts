/** Contrôles des frontières : tout ce que l'application confie à un service
 *  extérieur — le site du Grand Palais qu'elle lit, la notification et
 *  l'e-mail qu'elle envoie. Chacun a déjà été cassé sans que personne ne
 *  s'en aperçoive, faute d'un endroit où le constater.
 */

import type { BoundaryReport } from "../../src/grandPalaisProgramTypes.ts";

export type { BoundaryReport };

/** Une frontière et son verdict. Le nom s'affiche tel quel dans
 *  l'application ; le détail dit ce qu'il faut savoir — le nombre
 *  d'appareils inscrits, la cause d'un échec. */
export type BoundaryStatus = BoundaryReport["boundaries"][number];

function environment(name: string) {
  return (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(key: string): string | undefined } };
  }).Netlify?.env?.get(name);
}

/** Le site officiel se lit-il encore ? Une refonte de sa structure ferait
 *  tomber le nombre d'événements à zéro sans lever d'erreur. */
export async function checkGrandPalaisSite(
  collect: () => Promise<unknown[]>,
): Promise<BoundaryStatus> {
  try {
    const events = await collect();
    return events.length
      ? { name: "Programme du Grand Palais", ok: true, detail: `${events.length} événements lus` }
      : {
          name: "Programme du Grand Palais",
          ok: false,
          detail: "Aucun événement lu : la structure du site a peut-être changé",
        };
  } catch (error) {
    return {
      name: "Programme du Grand Palais",
      ok: false,
      detail: error instanceof Error ? error.message : "Lecture impossible",
    };
  }
}

/** La liaison avec le planning partagé, et surtout : un appareil écoute-t-il ?
 *  Une liaison parfaite sans appareil inscrit n'alerte personne. */
export async function checkNotificationChannel(
  check: () => Promise<{ devices: number } | null>,
): Promise<BoundaryStatus> {
  const name = "Notification sur le téléphone";
  try {
    const result = await check();
    if (!result)
      return {
        name,
        ok: false,
        detail: "Le planning partagé n’a pas répondu, ou n’a pas reconnu le secret de liaison",
      };
    return result.devices > 0
      ? { name, ok: true, detail: `${result.devices} appareil${result.devices > 1 ? "s" : ""} inscrit${result.devices > 1 ? "s" : ""}` }
      : { name, ok: false, detail: "Aucun appareil inscrit : aucune notification n’arrivera" };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : "Liaison indisponible" };
  }
}

/** La configuration d'envoi tient-elle ? On interroge Resend sans envoyer :
 *  une clé révoquée est le défaut le plus probable, et l'expéditeur de
 *  démonstration ne livre qu'au titulaire du compte. */
export async function checkEmailChannel(
  fetcher: typeof fetch = fetch,
  env = {
    apiKey: environment("RESEND_API_KEY"),
    recipient: environment("PROGRAM_ADMIN_EMAIL"),
    from: environment("PROGRAM_ALERT_FROM"),
  },
): Promise<BoundaryStatus> {
  const name = "Alerte par e-mail";
  const missing = [
    env.apiKey ? "" : "RESEND_API_KEY",
    env.recipient ? "" : "PROGRAM_ADMIN_EMAIL",
    env.from ? "" : "PROGRAM_ALERT_FROM",
  ].filter(Boolean);
  if (missing.length)
    return { name, ok: false, detail: `Configuration incomplète : ${missing.join(", ")}` };
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${env.apiKey}` },
    });
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : "Service injoignable" };
  }
  if (!response.ok)
    return { name, ok: false, detail: `Clé refusée par Resend (${response.status})` };
  // Avec l'expéditeur de démonstration, Resend ne livre qu'à l'adresse du
  // titulaire du compte, et les messages partent souvent en indésirables.
  if ((env.from || "").includes("onboarding@resend.dev"))
    return {
      name,
      ok: true,
      detail: "Clé valide, mais l’expéditeur de démonstration ne livre qu’au titulaire du compte",
    };
  return { name, ok: true, detail: "Clé valide" };
}

/** Un envoi réel par mois : c'est le seul moyen de prouver qu'un message
 *  arrive vraiment, et non qu'un service a accepté de le prendre. */
export function deliveryProofDue(report: BoundaryReport | null, now: string) {
  if (!report?.lastDeliveryAt) return true;
  return report.lastDeliveryAt.slice(0, 7) !== now.slice(0, 7);
}
