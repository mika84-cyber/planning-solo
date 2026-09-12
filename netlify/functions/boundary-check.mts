import { getStore } from "@netlify/blobs";
import {
  checkEmailChannel,
  checkGrandPalaisSite,
  checkNotificationChannel,
  deliveryProofDue,
  type BoundaryReport,
} from "../lib/boundaryChecks.mts";
import {
  collectGrandPalaisEvents,
  sendPlanningEmail,
} from "../lib/grandPalaisMonitor.mts";
import {
  checkSharedNotificationChannel,
  sendSharedPlanningNotification,
} from "../lib/sharedCalendarBridge.mts";

/** Contrôle hebdomadaire de tout ce qui sort de l'application. Le résultat
 *  est écrit dans le magasin, jamais envoyé : un contrôle ne peut pas rendre
 *  compte par le canal qu'il teste. L'application l'affiche.
 */
export default async function checkBoundaries() {
  // Deux créneaux UTC couvrent l'heure d'été et l'heure d'hiver, et les deux
  // jours possibles : on ne garde que le lundi à minuit, heure de Paris.
  const paris = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date());
  const parisHour = paris.find((part) => part.type === "hour")?.value;
  const parisWeekday = paris.find((part) => part.type === "weekday")?.value;
  if (parisHour !== "00" || parisWeekday !== "Mon")
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  const store = getStore({ name: "planning-solo-program", consistency: "strong" });
  const previous = (await store.get("health", { type: "json" })) as BoundaryReport | null;
  const now = new Date().toISOString();

  const boundaries = await Promise.all([
    checkGrandPalaisSite(() => collectGrandPalaisEvents()),
    checkNotificationChannel(checkSharedNotificationChannel),
    checkEmailChannel(),
  ]);

  /* Une fois par mois, un envoi réel sur les deux canaux. Les contrôles
     ci-dessus prouvent qu'une porte s'ouvre ; seul un message reçu prouve
     qu'il arrive. Le mois en cours sert de repère, pas un compte à rebours :
     une exécution manquée ne décale pas les suivantes. */
  let lastDeliveryAt = previous?.lastDeliveryAt;
  let deliveryDetail = previous?.deliveryDetail;
  if (deliveryProofDue(previous, now)) {
    const stamp = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" })
      .format(new Date(now));
    const results: string[] = [];
    try {
      const sent = await sendSharedPlanningNotification({
        title: "Planning Solo — contrôle mensuel",
        body: `Vos alertes fonctionnent. Contrôle du ${stamp}.`,
        url: "https://planning-solo.netlify.app/",
        tag: "planning-boundary-check",
      });
      results.push(sent ? "notification envoyée" : "notification refusée");
    } catch (error) {
      results.push(`notification en échec (${error instanceof Error ? error.message : "cause inconnue"})`);
    }
    try {
      await sendPlanningEmail(
        `Planning Solo — contrôle mensuel des alertes (${stamp})`,
        `<p>Ce message ne signale aucun changement : il prouve simplement que les alertes de Planning Solo vous parviennent.</p><p>Contrôle du ${stamp}.</p>`,
      );
      results.push("e-mail envoyé");
    } catch (error) {
      results.push(`e-mail en échec (${error instanceof Error ? error.message : "cause inconnue"})`);
    }
    lastDeliveryAt = now;
    deliveryDetail = results.join(" · ");
  }

  const report: BoundaryReport = { checkedAt: now, boundaries, lastDeliveryAt, deliveryDetail };
  await store.setJSON("health", report);
  for (const boundary of boundaries)
    if (!boundary.ok) console.warn(`Contrôle de frontière en échec — ${boundary.name} : ${boundary.detail}`);
  return new Response(JSON.stringify(report), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Lundi, minuit à Paris : deux créneaux UTC, un seul retenu selon la saison.
export const config = { schedule: "10 22,23 * * 0,1" };
