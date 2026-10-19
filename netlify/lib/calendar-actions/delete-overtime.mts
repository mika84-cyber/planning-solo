import { json, validId, type OvertimeEntry } from "../calendarShared.mts";
import { acquireAtomicLock } from "../calendarAtomic.mts";
import { readRecoveryBalance } from "../recoveryBalance.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleDeleteOvertime(
  context: CalendarActionContext,
): Promise<Response> {
  const { body, store, scopedKey } = context;
  const id = typeof body.id === "string" ? body.id : "";
  if (!validId(id)) return json({ error: "Heure supplémentaire invalide" }, 400);
  const target = (await store.get(scopedKey(`overtime/${id}`), {
    type: "json",
  })) as OvertimeEntry | null;
  if (target?.disposition !== "recovery") {
    await store.delete(scopedKey(`overtime/${id}`));
    return json({ ok: true, deleted: true });
  }
  // Même verrou que les récupérations : une demande en cours ne peut pas
  // consommer le crédit pendant qu'on le retire.
  const release = await acquireAtomicLock(store, scopedKey("lock/recovery-balance"));
  if (!release) return json({ error: "Le solde est en cours de modification. Réessayez." }, 409);
  try {
    // Le crédit retiré est celui que le solde comptait, majoration comprise.
    const balance = await readRecoveryBalance(context);
    const used = balance.recoveryUses.reduce((total, item) => total + item.minutes, 0);
    if (balance.earned - balance.creditOf(target) < used)
      return json(
        {
          error:
            "Cette récupération a déjà été utilisée. Annulez d’abord les récupérations posées.",
        },
        409,
      );
    await store.delete(scopedKey(`overtime/${id}`));
    return json({ ok: true, deleted: true });
  } finally {
    await release();
  }
}
