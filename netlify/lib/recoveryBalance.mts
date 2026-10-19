import { overtimeRecoveryCreditMinutes, storedHolidayRecoveryCreditMinutes } from "../../src/overtime.ts";
import { fromKey, getDayInfo } from "../../src/planningLogic.ts";
import { isCalendarTombstone } from "./calendarAtomic.mts";
import { listBlobs, type CalendarEntry, type FormProfile, type OvertimeEntry, type RecoveryUse } from "./calendarShared.mts";
import type { CalendarActionContext } from "./calendar-actions/context.mts";

type BalanceContext = Pick<
  CalendarActionContext,
  "store" | "scopedKey" | "entryPrefix" | "overtimePrefix" | "recoveryUsePrefix"
>;

async function readAll<T>(context: BalanceContext, prefix: string): Promise<T[]> {
  const { blobs } = await listBlobs(context.store, prefix);
  const values: unknown[] = await Promise.all(blobs.map((blob) =>
    context.store.get(blob.key, { type: "json" })));
  // Une donnée annulée par un lot garde une pierre tombale : elle ne compte pas.
  return values.filter((value) => Boolean(value) && !isCalendarTombstone(value)) as T[];
}

/** Le solde d'heures de récupération, calculé comme dans l'application :
 *  heures supplémentaires majorées (× 1,25 le jour, 5/3 le dimanche ou un
 *  férié, × 2 la nuit) et fériés travaillés pris en récupération, moins les
 *  récupérations posées. Les fériés suivent le groupe du profil. */
export async function readRecoveryBalance(context: BalanceContext, fallbackGroup = 1) {
  const [profile, overtime, recoveryUses, entries] = await Promise.all([
    context.store.get(context.scopedKey("form-profile"), { type: "json" }) as Promise<FormProfile | null>,
    readAll<OvertimeEntry>(context, context.overtimePrefix),
    readAll<RecoveryUse>(context, context.recoveryUsePrefix),
    readAll<CalendarEntry>(context, context.entryPrefix),
  ]);
  const profileGroup = Number(profile?.group);
  const group = [1, 2, 3].includes(profileGroup) ? profileGroup : fallbackGroup;
  const isSundayOrHoliday = (key: string) => {
    const date = fromKey(key);
    return date.getDay() === 0 || Boolean(getDayInfo(date, group).holiday);
  };
  const creditOf = (item: OvertimeEntry) => item.disposition === "recovery"
    ? overtimeRecoveryCreditMinutes({
      id: item.id,
      date: item.date,
      minutes: item.minutes,
      dayMinutes: item.day_minutes,
      nightMinutes: item.night_minutes,
      disposition: item.disposition,
      inputMode: item.input_mode,
      start: item.start,
      end: item.end,
      updatedAt: item.updated_at,
    }, isSundayOrHoliday)
    : 0;
  const earned = overtime.reduce((total, item) => total + creditOf(item), 0) +
    storedHolidayRecoveryCreditMinutes(entries.filter((item) => item.holiday_pay === "recovery"));
  return { profile, recoveryUses, earned, creditOf };
}
