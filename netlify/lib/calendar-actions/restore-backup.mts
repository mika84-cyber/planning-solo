import { sanitizeCalendarBackup } from "../calendarBackup.mts";
import { json, listBlobs } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";

/**
 * Restaure une sauvegarde sans jamais laisser le compte vide.
 *
 * L'ordre est volontaire : archiver, puis écrire le nouvel état, et seulement
 * ensuite supprimer les clés que la sauvegarde ne contient plus. Supprimer
 * d'abord exposait le compte à une perte totale si la fonction s'arrêtait
 * entre les deux phases — un risque réel avec plusieurs années de données.
 *
 * Si une écriture échoue, les clés déjà réécrites sont remises dans leur état
 * précédent et aucune suppression n'a lieu : le compte reste tel qu'il était.
 */
export async function handleRestoreBackup(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
    entryPrefix,
    periodPrefix,
    overtimePrefix,
    recoveryUsePrefix,
    mecenatPrefix,
  } = context;
  const sanitized = sanitizeCalendarBackup(body.backup);
  if ("error" in sanitized) return json({ error: sanitized.error }, 400);
  const [currentEntries, currentPeriods, currentOvertime, currentRecoveryUses, currentMecenat, currentProfile] = await Promise.all([
    listBlobs(store, entryPrefix),
    listBlobs(store, periodPrefix),
    listBlobs(store, overtimePrefix),
    listBlobs(store, recoveryUsePrefix),
    listBlobs(store, mecenatPrefix),
    store.get(scopedKey("form-profile"), { type: "json" }),
  ]);
  // Une restauration ne détruit jamais silencieusement l'état précédent :
  // on en conserve une copie privée, datée, dans le même espace utilisateur.
  const archivePrefix = scopedKey(
    `restore-archive/${new Date().toISOString().replace(/[:.]/g, "-")}/`,
  );
  const archive = async (key: string, family: string, prefix: string) => {
    const value = await store.get(key, { type: "json" });
    if (value !== null)
      await store.setJSON(`${archivePrefix}${family}/${key.slice(prefix.length)}`, value);
  };
  await Promise.all([
    ...currentEntries.blobs.map((blob) => archive(blob.key, "entry", entryPrefix)),
    ...currentPeriods.blobs.map((blob) => archive(blob.key, "period", periodPrefix)),
    ...currentOvertime.blobs.map((blob) => archive(blob.key, "overtime", overtimePrefix)),
    ...currentRecoveryUses.blobs.map((blob) => archive(blob.key, "recovery-use", recoveryUsePrefix)),
    ...currentMecenat.blobs.map((blob) => archive(blob.key, "mecenat", mecenatPrefix)),
    currentProfile === null
      ? Promise.resolve()
      : store.setJSON(`${archivePrefix}form-profile`, currentProfile),
  ]);

  const restored: Array<{ key: string; value: unknown }> = [
    ...sanitized.backup.entries.map((entry) => ({
      key: scopedKey(`entry/${entry.date}`),
      value: entry as unknown,
    })),
    ...sanitized.backup.periods.map((period) => ({
      key: scopedKey(`period/${period.id}`),
      value: period as unknown,
    })),
    ...sanitized.backup.overtime_entries.map((entry) => ({
      key: scopedKey(`overtime/${entry.id}`),
      value: entry as unknown,
    })),
    ...sanitized.backup.recovery_uses.map((entry) => ({
      key: scopedKey(`recovery-use/${entry.id}`),
      value: entry as unknown,
    })),
    ...sanitized.backup.mecenat_entries.map((entry) => ({
      key: scopedKey(`mecenat/${entry.id}`),
      value: entry as unknown,
    })),
    ...(sanitized.backup.form_profile
      ? [{
        key: scopedKey("form-profile"),
        value: sanitized.backup.form_profile as unknown,
      }]
      : []),
  ];

  // Relevé des valeurs actuelles des seules clés réécrites : il sert au
  // retour arrière si une écriture échoue en cours de route.
  const previous = new Map<string, unknown>();
  for (const { key } of restored)
    if (!previous.has(key)) previous.set(key, await store.get(key, { type: "json" }));

  const written: string[] = [];
  try {
    // Écritures séquentielles, comme pour les lots de périodes : elles évitent
    // une rafale de requêtes vers Blobs sur une grosse sauvegarde.
    for (const { key, value } of restored) {
      await store.setJSON(key, value);
      written.push(key);
    }
  } catch (writeError) {
    let rollbackFailed = false;
    for (const key of written) {
      try {
        const original = previous.get(key) ?? null;
        if (original === null) await store.delete(key);
        else await store.setJSON(key, original);
      } catch {
        rollbackFailed = true;
      }
    }
    console.error("restore-backup: écriture interrompue, aucune suppression effectuée", {
      written: written.length,
      total: restored.length,
      rollbackFailed,
      cause: writeError instanceof Error ? writeError.message : String(writeError),
    });
    return json(
      {
        error: rollbackFailed
          ? "La restauration a échoué et n’a pas pu être entièrement annulée. Vos données précédentes restent archivées : rouvrez l’application avant de réessayer."
          : "La restauration a échoué. Aucune donnée n’a été supprimée : votre compte est resté dans son état précédent.",
        removed: false,
        rolled_back: !rollbackFailed,
      },
      500,
    );
  }

  // Le nouvel état est en place : on ne retire plus que les clés que la
  // sauvegarde ne contient pas.
  const keptKeys = new Set(restored.map(({ key }) => key));
  const obsolete = [
    ...currentEntries.blobs.map((blob) => blob.key),
    ...currentPeriods.blobs.map((blob) => blob.key),
    ...currentOvertime.blobs.map((blob) => blob.key),
    ...currentRecoveryUses.blobs.map((blob) => blob.key),
    ...currentMecenat.blobs.map((blob) => blob.key),
    ...(currentProfile === null ? [] : [scopedKey("form-profile")]),
  ].filter((key) => !keptKeys.has(key));
  await Promise.all(obsolete.map((key) => store.delete(key)));

  return json({ ok: true, restored: true, removed: obsolete.length });
}
