import { json, listBlobs } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleBatch(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    request,
    store,
    scopedKey,
    entryPrefix,
    periodPrefix,
    overtimePrefix,
    recoveryUsePrefix,
    mecenatPrefix,
    calendarHandler,
  } = context;
  const operations = Array.isArray(body.operations) ? body.operations : [];
  const forbidden = new Set([
    "batch",
    "restore-backup",
    "delete-user-data",
    "archive-legacy-data",
    "save-request",
    "save-periods",
  ]);
  if (
    operations.length < 1 ||
    operations.length > 400 ||
    operations.some(
      (operation) =>
        !operation ||
        typeof operation !== "object" ||
        forbidden.has(String((operation as Record<string, unknown>).action)),
    )
  )
    return json({ error: "Lot d’opérations invalide" }, 400);

  // Netlify Blobs n'offre pas de transaction multi-clés. On prend donc un
  // instantané privé avant le lot et on le restaure si une sous-opération
  // échoue : l'utilisateur ne reste jamais avec une sauvegarde partielle.
  const [entryList, periodList, overtimeList, recoveryUseList, mecenatList, profile] = await Promise.all([
    listBlobs(store, entryPrefix),
    listBlobs(store, periodPrefix),
    listBlobs(store, overtimePrefix),
    listBlobs(store, recoveryUsePrefix),
    listBlobs(store, mecenatPrefix),
    store.get(scopedKey("form-profile"), { type: "json" }),
  ]);
  const snapshot = await Promise.all(
    [...entryList.blobs, ...periodList.blobs, ...overtimeList.blobs, ...recoveryUseList.blobs, ...mecenatList.blobs].map(async (blob) => ({
      key: blob.key,
      value: await store.get(blob.key, { type: "json" }),
    })),
  );
  const rollback = async () => {
    const [newEntries, newPeriods, newOvertime, newRecoveryUses, newMecenat] = await Promise.all([
      listBlobs(store, entryPrefix),
      listBlobs(store, periodPrefix),
      listBlobs(store, overtimePrefix),
      listBlobs(store, recoveryUsePrefix),
      listBlobs(store, mecenatPrefix),
    ]);
    await Promise.all([
      ...newEntries.blobs.map((blob) => store.delete(blob.key)),
      ...newPeriods.blobs.map((blob) => store.delete(blob.key)),
      ...newOvertime.blobs.map((blob) => store.delete(blob.key)),
      ...newRecoveryUses.blobs.map((blob) => store.delete(blob.key)),
      ...newMecenat.blobs.map((blob) => store.delete(blob.key)),
      store.delete(scopedKey("form-profile")),
    ]);
    await Promise.all([
      ...snapshot.map(({ key, value }) =>
        value === null ? Promise.resolve() : store.setJSON(key, value),
      ),
      profile === null
        ? Promise.resolve()
        : store.setJSON(scopedKey("form-profile"), profile),
    ]);
  };

  const results: unknown[] = [];
  try {
    for (const operation of operations) {
      const response = await calendarHandler(
        new Request(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(operation),
        }),
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        await rollback();
        return json(
          {
            error:
              result && typeof result === "object" && "error" in result
                ? result.error
                : "Le lot n’a pas pu être enregistré",
            rolled_back: true,
          },
          response.status,
        );
      }
      results.push(result);
    }
    return json({ ok: true, results });
  } catch {
    await rollback();
    return json(
      { error: "Le lot n’a pas pu être enregistré", rolled_back: true },
      500,
    );
  }
}
