import { getStore } from "@netlify/blobs";
import {
  collectGrandPalaisEvents,
  detectGrandPalaisChanges,
  isGrandPalaisProposalRelevant,
  sendGrandPalaisAlertEmail,
  type GrandPalaisMonitorState,
} from "../lib/grandPalaisMonitor.mts";
import type { GrandPalaisProgramProposal } from "../../src/grandPalaisProgramTypes.ts";

export default async function monitorGrandPalaisProgram() {
  // Netlify schedules in UTC: only one of the two daily slots is midnight in Paris.
  const parisHour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find(part => part.type === "hour")?.value;
  if (parisHour !== "00") return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { "content-type": "application/json; charset=utf-8" } });
  const store = getStore({ name: "planning-solo-program", consistency: "strong" });
  const [state, pending] = await Promise.all([
    store.get("monitor-state", { type: "json" }) as Promise<GrandPalaisMonitorState | null>,
    store.get("pending", { type: "json" }) as Promise<GrandPalaisProgramProposal[] | null>,
  ]);
  const events = await collectGrandPalaisEvents();
  const detected = detectGrandPalaisChanges(state, events);
  const existingIds = new Set((pending ?? []).map((proposal) => proposal.id));
  const fresh = detected.proposals.filter((proposal) => {
    const event = proposal.next ?? proposal.previous;
    return event && isGrandPalaisProposalRelevant(event) && !existingIds.has(proposal.id);
  });

  await Promise.all([
    store.setJSON("monitor-state", detected.state),
    fresh.length ? store.setJSON("pending", [...(pending ?? []), ...fresh]) : Promise.resolve(),
  ]);

  let alertSent = false;
  let alertWarning = "";
  if (fresh.length) {
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
    alertSent,
    alertWarning,
    checkedAt: detected.state.lastCheckedAt,
  }), { headers: { "content-type": "application/json; charset=utf-8" } });
}

export const config = { schedule: "5 22,23 * * *" };
