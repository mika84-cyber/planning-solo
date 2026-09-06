import { isValidDateKey } from "../calendarValidation.mts";
import { json, validId } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";

/** Valide une suppression de note appartenant au calendrier partenaire.
 * Aucune donnée locale n'est modifiée : l'écriture est transmise au pont
 * privé après ce contrôle par la fonction calendrier. */
export async function handleDeleteSharedPartnerNote(
  context: CalendarActionContext,
): Promise<Response> {
  const groupId = typeof context.body.groupId === "string" ? context.body.groupId : "";
  const date = typeof context.body.date === "string" ? context.body.date : "";
  if (groupId && !validId(groupId))
    return json({ error: "Identifiant invalide" }, 400);
  if (!groupId && !isValidDateKey(date))
    return json({ error: "Note invalide" }, 400);
  return json({ ok: true });
}
