import { handleSaveRequest } from "./save-request.mts";
import { handleSavePeriods } from "./save-periods.mts";
import { handleBatch } from "./batch.mts";
import { handleRestoreBackup } from "./restore-backup.mts";
import { handleDeleteUserData } from "./delete-user-data.mts";
import { handleArchiveLegacyData } from "./archive-legacy-data.mts";
import { handleSaveFormProfile } from "./save-form-profile.mts";
import { handleSaveMecenat } from "./save-mecenat.mts";
import { handleDeleteMecenat } from "./delete-mecenat.mts";
import { handleSaveOvertime } from "./save-overtime.mts";
import { handleDeleteOvertime } from "./delete-overtime.mts";
import { handleSaveRecoveryUse } from "./save-recovery-use.mts";
import { handleDeleteRecoveryUse } from "./delete-recovery-use.mts";
import { handleSavePeriod } from "./save-period.mts";
import { handleDeletePeriod } from "./delete-period.mts";
import { handleClearLegacyPeriod } from "./clear-legacy-period.mts";
import { handleSaveNotePeriod } from "./save-note-period.mts";
import { handleDeleteNotePeriod } from "./delete-note-period.mts";
import { handleSaveLeaves } from "./save-leaves.mts";
import { handleSaveEntry } from "./save-entry.mts";
import { json } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";

type CalendarActionHandler = (context: CalendarActionContext) => Promise<Response>;

const actionHandlers: Record<string, CalendarActionHandler> = {
  "save-request": handleSaveRequest,
  "save-periods": handleSavePeriods,
  "batch": handleBatch,
  "restore-backup": handleRestoreBackup,
  "delete-user-data": handleDeleteUserData,
  "archive-legacy-data": handleArchiveLegacyData,
  "save-form-profile": handleSaveFormProfile,
  "save-mecenat": handleSaveMecenat,
  "delete-mecenat": handleDeleteMecenat,
  "save-overtime": handleSaveOvertime,
  "delete-overtime": handleDeleteOvertime,
  "save-recovery-use": handleSaveRecoveryUse,
  "delete-recovery-use": handleDeleteRecoveryUse,
  "save-period": handleSavePeriod,
  "delete-period": handleDeletePeriod,
  "clear-legacy-period": handleClearLegacyPeriod,
  "save-note-period": handleSaveNotePeriod,
  "delete-note-period": handleDeleteNotePeriod,
  "save-leaves": handleSaveLeaves,
  "save-entry": handleSaveEntry,
};

export const CALENDAR_ACTIONS = Object.freeze(Object.keys(actionHandlers));

export async function handleCalendarAction(
  context: CalendarActionContext,
): Promise<Response> {
  const action = typeof context.body.action === "string" ? context.body.action : "";
  const handler = actionHandlers[action];
  return handler
    ? handler(context)
    : json({ error: "Action inconnue" }, 400);
}
