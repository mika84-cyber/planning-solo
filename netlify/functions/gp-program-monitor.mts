import { getStore } from "@netlify/blobs";
import {
  collectGrandPalaisEvents,
  detectGrandPalaisChanges,
  isGrandPalaisProposalRelevant,
  isPriceOnlyChange,
  sendGrandPalaisAlertEmail,
  syncGrandPalaisPrices,
  type GrandPalaisMonitorState,
} from "../lib/grandPalaisMonitor.mts";
import { sendSharedPlanningNotification } from "../lib/sharedCalendarBridge.mts";
import type {
  GrandPalaisDismissal,
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "../../src/grandPalaisProgramTypes.ts";

/** Jours où la veille passe aussi en dehors de minuit, à la demande de
 *  l'administrateur (date de Paris). Le créneau de 14 h UTC du planning ne sert
 *  qu'à ces jours-là ; tous les autres jours, seul le passage de minuit agit. */
export const EXCEPTIONAL_RUN_DAYS = ["2026-10-08"];

export default async function monitorGrandPalaisProgram() {
  // Netlify schedules in UTC: only one of the two daily slots is midnight in Paris.
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const parisHour = part("hour");
  const parisDay = `${part("year")}-${part("month")}-${part("day")}`;
  if (parisHour !== "00" && !EXCEPTIONAL_RUN_DAYS.includes(parisDay)) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { "content-type": "application/json; charset=utf-8" } });
  const store = getStore({ name: "planning-solo-program", consistency: "strong" });
  const [state, storedPending, dismissed, storedApproved] = await Promise.all([
    store.get("monitor-state", { type: "json" }) as Promise<GrandPalaisMonitorState | null>,
    store.get("pending", { type: "json" }) as Promise<GrandPalaisProgramProposal[] | null>,
    store.get("dismissed", { type: "json" }) as Promise<GrandPalaisDismissal[] | null>,
    store.get("approved", { type: "json" }) as Promise<SharedGrandPalaisEvent[] | null>,
  ]);
  const events = await collectGrandPalaisEvents();
  const detected = detectGrandPalaisChanges(state, events);
  // Les tarifs se mettent à jour d'eux-mêmes : seuls les autres changements
  // attendent l'accord de l'administrateur.
  const prices = syncGrandPalaisPrices(storedApproved ?? [], storedPending ?? [], events);
  const pending = prices.pending;
  const existingIds = new Set(pending.map((proposal) => proposal.id));
  // Un événement déjà écarté ne revient pas comme une nouveauté : seule une
  // modification constatée sur le site justifie de redemander.
  const dismissedIds = new Set((dismissed ?? []).map((item) => item.eventId));
  const fresh = detected.proposals.filter((proposal) => {
    const event = proposal.next ?? proposal.previous;
    if (!event || !isGrandPalaisProposalRelevant(event) || existingIds.has(proposal.id) || isPriceOnlyChange(proposal)) return false;
    return !(proposal.kind === "new" && dismissedIds.has(event.id));
  });

  await Promise.all([
    store.setJSON("monitor-state", detected.state),
    fresh.length || prices.changed ? store.setJSON("pending", [...pending, ...fresh]) : Promise.resolve(),
    prices.changed ? store.setJSON("approved", prices.approved) : Promise.resolve(),
  ]);

  let alertSent = false;
  let alertWarning = "";
  let pushSent = false;
  let pushWarning = "";
  if (fresh.length) {
    // Deux canaux plutôt qu'un : la notification prévient tout de suite, l'e-mail
    // reste le filet si le téléphone est éteint ou l'autorisation retirée.
    const summary = fresh
      .map((proposal) => (proposal.next ?? proposal.previous)?.title)
      .filter(Boolean)
      .join(" · ");
    try {
      pushSent = await sendSharedPlanningNotification({
        title: `Grand Palais : ${fresh.length} changement${fresh.length > 1 ? "s" : ""}`,
        body: `${summary} — ouvrez Programmation GP pour accepter ou ignorer.`,
        url: "https://planning-solo.netlify.app/",
        tag: "gp-program-proposal",
      });
      if (!pushSent) pushWarning = "Notification non confirmée par le planning partagé";
    } catch (error) {
      pushWarning = error instanceof Error ? error.message : "Notification indisponible";
    }
    if (pushWarning)
      console.warn("Grand Palais monitor: notification non envoyée", pushWarning);
    try {
      await sendGrandPalaisAlertEmail(fresh);
      alertSent = true;
    } catch (error) {
      alertWarning = error instanceof Error ? error.message : "Alerte e-mail indisponible";
      console.warn("Grand Palais monitor: proposals saved without email alert", alertWarning);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    checked: events.length,
    detected: fresh.length,
    pricesUpdated: prices.changed,
    alertSent,
    alertWarning,
    pushSent,
    pushWarning,
    checkedAt: detected.state.lastCheckedAt,
  }), { headers: { "content-type": "application/json; charset=utf-8" } });
}

export const config = { schedule: "5 14,22,23 * * *" };
