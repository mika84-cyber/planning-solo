import { getStore } from "@netlify/blobs";
import {
  collectGrandPalaisEvents,
  detectGrandPalaisChanges,
  isGrandPalaisProposalRelevant,
  isPriceOnlyChange,
  sendGrandPalaisAlertEmail,
  syncGrandPalaisPrices,
  type GrandPalaisMonitorState,
} from "./grandPalaisMonitor.mts";
import { sendSharedPlanningNotification } from "./sharedCalendarBridge.mts";
import type {
  GrandPalaisDismissal,
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "../../src/grandPalaisProgramTypes.ts";

/** Clé de la demande de contrôle déposée par l'administrateur. */
export const CHECK_REQUEST_KEY = "check-request";

/** Un passage de la veille : lit le site, met les tarifs à jour, garde les
 *  autres changements en attente d'accord et prévient l'administrateur.
 *  Partagé par le passage de minuit et le contrôle lancé à la main. */
export async function runGrandPalaisCheck() {
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

  return {
    ok: true,
    checked: events.length,
    detected: fresh.length,
    pricesUpdated: prices.changed,
    alertSent,
    alertWarning,
    pushSent,
    pushWarning,
    checkedAt: detected.state.lastCheckedAt,
  };
}
