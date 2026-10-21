import { getStore } from "@netlify/blobs";
import {
  CHECK_FAILURE_KEY,
  CHECK_REQUEST_KEY,
  grandPalaisCheckFailureMessage,
  runGrandPalaisCheck,
} from "../lib/grandPalaisCheck.mts";
import type { GrandPalaisCheckFailure } from "../../src/grandPalaisProgramTypes.ts";

/** Délai pendant lequel une demande de contrôle reste valable. */
const REQUEST_VALIDITY_MS = 5 * 60_000;

/**
 * Contrôle du site du Grand Palais lancé à la main par l'administrateur.
 *
 * Fonction d'arrière-plan (suffixe « -background ») : la lecture de toutes
 * les pages du programme dépasse le délai d'une requête ordinaire. Elle ne
 * vérifie pas elle-même le compte : elle n'agit que si `/api/gp-program`,
 * qui le vérifie, vient de déposer une demande. Un appel sans demande ne
 * fait rien.
 */
export default async function checkGrandPalaisProgramNow() {
  const store = getStore({ name: "planning-solo-program", consistency: "strong" });
  const request = (await store.get(CHECK_REQUEST_KEY, { type: "json" })) as { at?: string } | null;
  const requestedAt = Date.parse(request?.at || "");
  if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > REQUEST_VALIDITY_MS) return;
  await store.delete(CHECK_REQUEST_KEY);
  try {
    await runGrandPalaisCheck();
  } catch (error) {
    console.error("Contrôle manuel du Grand Palais impossible", error instanceof Error ? error.message : error);
    // Sans trace de l'échec, la veille attendait en vain une nouvelle date
    // de contrôle : « Lecture en cours… » restait affiché quatre minutes.
    const failure: GrandPalaisCheckFailure = {
      requestedAt: request!.at!,
      at: new Date().toISOString(),
      message: grandPalaisCheckFailureMessage(error),
    };
    await store.setJSON(CHECK_FAILURE_KEY, failure).catch(() => undefined);
  }
}
