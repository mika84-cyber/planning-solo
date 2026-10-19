import type { getStore } from "@netlify/blobs";
import { acquireAtomicLock } from "./calendarAtomic.mts";
import { listBlobs } from "./calendarShared.mts";
import { bridgeConfigured, postBridgeOperation } from "./sharedCalendarBridge.mts";

/* Copies vers le planning d'Agnès qui n'ont pas abouti.

   Une écriture de Mika réussit même quand le planning d'Agnès ne répond pas.
   La copie manquée reste alors en attente dans l'espace de Mika, une clé par
   copie, datée : elle repart avant toute nouvelle copie, à la prochaine
   écriture ou à la prochaine ouverture de l'application. L'ordre est donc
   celui des écritures de Mika ; renvoyer deux fois la même copie ne change
   rien chez Agnès. */

type Store = ReturnType<typeof getStore>;
export type BridgeOperation = Record<string, unknown>;
type PendingOperation = { operation: BridgeOperation; queuedAt: string };
type Send = (operation: BridgeOperation) => Promise<"sent" | "rejected" | "retry">;

export const PENDING_BRIDGE_PREFIX = "shared-calendar-pending/";
export const BRIDGE_PAUSE_KEY = "shared-calendar-pending-pause";
const LOCK_KEY = "lock/shared-calendar-pending";
/** Chaque essai peut attendre quatre secondes : après un échec, le planning
 *  d'Agnès a deux minutes avant le suivant, et Mika n'attend pas à chaque
 *  enregistrement. */
const RETRY_PAUSE_MS = 2 * 60_000;
/** Au-delà, le reste attend la requête suivante. */
const SEND_BUDGET_MS = 8_000;
const SYNC_ACTION = "bridge-sync-mika-calendar";

async function enqueue(store: Store, scopedKey: (key: string) => string, operations: BridgeOperation[]) {
  const stamp = String(Date.now()).padStart(15, "0");
  const queuedAt = new Date().toISOString();
  for (const [index, operation] of operations.entries())
    await store.setJSON(
      scopedKey(`${PENDING_BRIDGE_PREFIX}${stamp}-${String(index).padStart(4, "0")}-${crypto.randomUUID()}`),
      { operation, queuedAt } satisfies PendingOperation,
    );
}

/**
 * Envoie les copies en attente, puis les nouvelles, dans l'ordre. Renvoie
 * « shared » quand tout est arrivé, « pending » quand il reste des copies à
 * envoyer plus tard, « disabled » sans liaison configurée.
 */
export async function deliverSharedOperations(
  store: Store,
  scopedKey: (key: string) => string,
  operations: BridgeOperation[],
  send: Send = postBridgeOperation,
): Promise<"shared" | "pending" | "disabled"> {
  if (!bridgeConfigured()) return "disabled";
  const listed = (await listBlobs(store, scopedKey(PENDING_BRIDGE_PREFIX))).blobs
    .map((blob) => blob.key)
    .sort();
  if (!listed.length && !operations.length) return "shared";
  const pause = (await store.get(scopedKey(BRIDGE_PAUSE_KEY), { type: "json" })) as { until?: string } | null;
  const paused = Date.parse(pause?.until || "") > Date.now();
  // Une autre requête envoie déjà, ou le planning d'Agnès est en pause : les
  // nouvelles copies attendent leur tour derrière les autres.
  const release = paused ? null : await acquireAtomicLock(store, scopedKey(LOCK_KEY), { attempts: 3 });
  if (!release) {
    await enqueue(store, scopedKey, operations);
    return "pending";
  }
  try {
    const queue = [
      ...(await Promise.all(listed.map(async (key) => ({
        key,
        operation: ((await store.get(key, { type: "json" })) as PendingOperation | null)?.operation,
      })))),
      ...operations.map((operation) => ({ key: "", operation })),
    ];
    // Chaque reprise des congés renvoie toutes les périodes : seule la
    // dernière compte.
    const lastSync = queue.findLastIndex((item) => item.operation?.action === SYNC_ACTION);
    const started = Date.now();
    let stoppedAt = -1;
    let unreachable = false;
    for (const [index, { key, operation }] of queue.entries()) {
      const skipped = !operation || (operation.action === SYNC_ACTION && index < lastSync);
      if (!skipped) {
        if (Date.now() - started > SEND_BUDGET_MS) {
          stoppedAt = index;
          break;
        }
        const outcome = await send(operation);
        if (outcome === "retry") {
          stoppedAt = index;
          unreachable = true;
          break;
        }
        if (outcome === "rejected")
          console.error("Copie refusée par le planning d’Agnès, abandonnée", operation.action);
      }
      if (key) await store.delete(key);
    }
    if (stoppedAt === -1) {
      if (pause) await store.delete(scopedKey(BRIDGE_PAUSE_KEY));
      return "shared";
    }
    // Les copies en attente le restent ; les nouvelles non envoyées les suivent.
    await enqueue(
      store,
      scopedKey,
      queue.slice(stoppedAt).filter((item) => !item.key && item.operation).map((item) => item.operation as BridgeOperation),
    );
    if (unreachable)
      await store.setJSON(scopedKey(BRIDGE_PAUSE_KEY), { until: new Date(Date.now() + RETRY_PAUSE_MS).toISOString() });
    return "pending";
  } finally {
    await release();
  }
}
