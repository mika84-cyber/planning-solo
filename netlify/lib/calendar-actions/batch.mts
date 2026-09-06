import { json, validId } from "../calendarShared.mts";
import { readAtomic, restoreAtomic } from "../calendarAtomic.mts";
import type { CalendarActionContext } from "./context.mts";

const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
function rangeKeys(from: unknown, to: unknown, scopedKey: (key: string) => string) {
  if (!validDate(from) || !validDate(to)) return [];
  const cursor = new Date(`${from}T12:00:00Z`), last = new Date(`${to}T12:00:00Z`), keys: string[] = [];
  for (let guard = 0; cursor <= last && guard < 400; guard += 1) {
    keys.push(scopedKey(`entry/${cursor.toISOString().slice(0, 10)}`)); cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}
async function affectedKeys(context: CalendarActionContext, operation: Record<string, unknown>) {
  const { store, scopedKey } = context, action = String(operation.action || "");
  if (action === "save-entry" || action === "save-leaves") return validDate(operation.date) ? [scopedKey(`entry/${operation.date}`)] : [];
  if (action === "save-form-profile") return [scopedKey("form-profile")];
  const kinds: Record<string, string> = { "save-period": "period", "delete-period": "period", "save-overtime": "overtime", "delete-overtime": "overtime", "save-recovery-use": "recovery-use", "delete-recovery-use": "recovery-use", "save-mecenat": "mecenat", "delete-mecenat": "mecenat" };
  if (kinds[action]) return validId(String(operation.id || "")) ? [scopedKey(`${kinds[action]}/${operation.id}`)] : [];
  if (action === "save-note-period" || action === "clear-legacy-period") return rangeKeys(operation.from, operation.to, scopedKey);
  if (action === "save-exchange") return [operation.agreementDate, operation.returnDate].filter(validDate).map((date) => scopedKey(`entry/${date}`));
  if (action === "delete-note-period" || action === "delete-exchange") {
    const field = action === "delete-note-period" ? "note_group_id" : "exchange_id";
    const wanted = String(action === "delete-note-period" ? operation.groupId || "" : operation.id || "");
    if (!wanted) return [];
    const listed = await store.list({ prefix: scopedKey("entry/") });
    const matches = await Promise.all(listed.blobs.map(async (blob) => {
      const item = await store.get(blob.key, { type: "json" }) as Record<string, unknown> | null;
      return item?.[field] === wanted ? blob.key : "";
    }));
    return matches.filter(Boolean);
  }
  return [];
}

export async function handleBatch(context: CalendarActionContext): Promise<Response> {
  const { body, request, store, calendarHandler } = context;
  const operations = Array.isArray(body.operations) ? body.operations as Record<string, unknown>[] : [];
  const forbidden = new Set(["batch", "restore-backup", "delete-user-data", "archive-legacy-data", "save-request", "save-periods", "delete-shared-partner-note"]);
  if (operations.length < 1 || operations.length > 400 || operations.some((item) => !item || typeof item !== "object" || forbidden.has(String(item.action)))) return json({ error: "Lot d’opérations invalide" }, 400);
  const operationKeys: string[][] = [];
  for (const operation of operations) {
    const keys = await affectedKeys(context, operation);
    if (!keys.length) return json({ error: "Une opération du lot ne peut pas être sécurisée" }, 400);
    operationKeys.push([...new Set(keys)]);
  }
  const originals = new Map<string, unknown>();
  for (const key of new Set(operationKeys.flat())) originals.set(key, (await readAtomic(store, key)).raw);
  const writtenEtags = new Map<string, string>();
  const rollback = async () => (await Promise.all([...writtenEtags].map(([key, etag]) => restoreAtomic(store, key, originals.get(key) ?? null, etag)))).every(Boolean);
  const results: unknown[] = [];
  try {
    for (let index = 0; index < operations.length; index += 1) {
      const beforeEtags = new Map<string, string>();
      for (const key of operationKeys[index]) beforeEtags.set(key, (await readAtomic(store, key)).etag);
      const response = await calendarHandler(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(operations[index]) }));
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const complete = await rollback();
        return json({ error: result && typeof result === "object" && "error" in result ? result.error : "Le lot n’a pas pu être enregistré", rolled_back: complete, ...(complete ? {} : { rollback_error: "Restauration incomplète : une donnée plus récente a été conservée." }) }, response.status);
      }
      for (const key of operationKeys[index]) {
        const exactEtag = operationKeys[index].length === 1 && result && typeof result === "object" && "writeEtag" in result
          ? String(result.writeEtag || "")
          : "";
        if (exactEtag) {
          writtenEtags.set(key, exactEtag);
          continue;
        }
        const current = await readAtomic(store, key);
        if (current.etag && current.etag !== beforeEtags.get(key)) writtenEtags.set(key, current.etag);
      }
      results.push(result);
    }
    return json({ ok: true, results });
  } catch {
    const complete = await rollback();
    return json({ error: "Le lot n’a pas pu être enregistré", rolled_back: complete, ...(complete ? {} : { rollback_error: "Restauration incomplète : une donnée plus récente a été conservée." }) }, 500);
  }
}
