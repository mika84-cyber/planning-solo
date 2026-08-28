import { getStore } from "@netlify/blobs";
import {
  collectGrandPalaisEvents,
  detectGrandPalaisChanges,
  sendGrandPalaisAlertEmail,
  type GrandPalaisMonitorState,
} from "../lib/grandPalaisMonitor.mts";
import type { GrandPalaisProgramProposal } from "../../src/grandPalaisProgramTypes.ts";

export default async function monitorGrandPalaisProgram() {
  const store = getStore({ name: "planning-solo-program", consistency: "strong" });
  const [state, pending] = await Promise.all([
    store.get("monitor-state", { type: "json" }) as Promise<GrandPalaisMonitorState | null>,
    store.get("pending", { type: "json" }) as Promise<GrandPalaisProgramProposal[] | null>,
  ]);
  const events = await collectGrandPalaisEvents();
  const detected = detectGrandPalaisChanges(state, events);
  const existingIds = new Set((pending ?? []).map((proposal) => proposal.id));
  const fresh = detected.proposals.filter((proposal) => !existingIds.has(proposal.id));

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

export const config = { schedule: "@daily" };
