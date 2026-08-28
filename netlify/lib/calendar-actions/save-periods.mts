import { normalizeBulkPeriods } from "../calendarValidation.mts";
import { json } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSavePeriods(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const normalized = normalizeBulkPeriods(body.periods);
  if ("error" in normalized) return json({ error: normalized.error }, 400);

  // Seules les clés de ce lot sont sauvegardées. Contrairement au batch
  // générique, le coût ne dépend donc plus de tout l'historique du compte.
  // Les identifiants fournis par le navigateur rendent aussi une seconde
  // tentative strictement idempotente après une coupure de connexion.
  const targets = normalized.periods.map((period) => ({
    key: scopedKey(`period/${period.id}`),
    period,
  }));
  const previous: any[] = [];
  for (const { key } of targets)
    previous.push(await store.get(key, { type: "json" }));
  const samePeriod = (left: any, right: typeof normalized.periods[number]) =>
    left?.id === right.id &&
    left?.from === right.from &&
    left?.to === right.to &&
    left?.leave_type === right.leave_type &&
    (left?.half_moment || "") === right.half_moment &&
    Number(left?.group) === Number(right.group);
  try {
    // Les écritures séquentielles évitent les rafales de requêtes fortes
    // vers Blobs. Lors d'une seconde tentative, une période déjà identique
    // est laissée intacte : le lot est réellement idempotent.
    for (let index = 0; index < targets.length; index++) {
      const { key, period } = targets[index];
      if (samePeriod(previous[index], period)) continue;
      await store.setJSON(key, period);
    }
  } catch (writeError) {
    // Une réponse Blobs peut être perdue après acceptation de l'écriture.
    // Avant d'annoncer un échec, on relit donc chaque identifiant.
    const confirmed: any[] = [];
    for (const { key } of targets) {
      try {
        confirmed.push(await store.get(key, { type: "json" }));
      } catch {
        confirmed.push(null);
      }
    }
    if (confirmed.every((period, index) => samePeriod(period, targets[index].period))) {
      console.warn("save-periods: réponse d'écriture perdue, lot confirmé par relecture", {
        count: targets.length,
      });
      return json({
        ok: true,
        periods: confirmed,
        recovered: true,
      });
    }
    let rollbackFailed = false;
    for (let index = 0; index < targets.length; index++) {
      try {
        if (previous[index] === null) await store.delete(targets[index].key);
        else await store.setJSON(targets[index].key, previous[index]);
      } catch {
        rollbackFailed = true;
      }
    }
    console.error("save-periods: échec réel du lot", {
      count: targets.length,
      rollbackFailed,
      cause: writeError instanceof Error ? writeError.message : String(writeError),
    });
    return json(
      {
        error: rollbackFailed
          ? "La synchronisation est incomplète. Rouvrez l’application avant de réessayer."
          : "Les congés n’ont pas pu être enregistrés. Aucune donnée n’a été modifiée.",
      },
      500,
    );
  }
  return json({
    ok: true,
    periods: targets.map(({ period }, index) =>
      samePeriod(previous[index], period) ? previous[index] : period,
    ),
  });
}
