import { json } from "../calendarShared.mts";
import { readAtomic, writeAtomic } from "../calendarAtomic.mts";
import { mergeFormSheets, readFormSheets, sanitizeFormSheet } from "../formSheets.mts";
import type { CalendarActionContext } from "./context.mts";

const FORM_SHEETS_KEY = "form-sheets";

/** Les feuilles déjà faites du formulaire, pour la liste « Reprendre ». */
export async function handleListFormSheets(context: CalendarActionContext): Promise<Response> {
  const stored = await context.store.get(context.scopedKey(FORM_SHEETS_KEY), { type: "json" });
  return json({ ok: true, form_sheets: readFormSheets(stored) });
}

/** Une feuille dont le PDF vient d'être créé, sur le téléphone ou
 *  l'ordinateur. Deux appareils qui écrivent en même temps : la seconde
 *  écriture relit la liste et réessaie, sans effacer la première. */
export async function handleSaveFormSheet(context: CalendarActionContext): Promise<Response> {
  const sheet = sanitizeFormSheet(context.body.sheet);
  if (!sheet) return json({ error: "Feuille invalide" }, 400);
  const key = context.scopedKey(FORM_SHEETS_KEY);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readAtomic<unknown>(context.store, key);
    const list = mergeFormSheets(readFormSheets(current.raw), sheet);
    if (await writeAtomic(context.store, key, list, current.etag))
      return json({ ok: true, form_sheets: list });
  }
  return json({ error: "La liste a été modifiée sur un autre appareil" }, 409);
}
