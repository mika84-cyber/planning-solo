import type { getStore } from "@netlify/blobs";
import {
  type CalendarEntry,
  type FormProfile,
  type LeavePeriod,
  type MecenatEntry,
  type OvertimeEntry,
  type RecoveryUse,
  json,
  listBlobs,
} from "./calendarShared.mts";
import { readAgnesSharedCalendar, syncExistingSharedCalendar } from "./sharedCalendarBridge.mts";
import { isCalendarTombstone } from "./calendarAtomic.mts";

type CalendarReadContext = {
  email: string;
  store: ReturnType<typeof getStore>;
  scopedKey: (key: string) => string;
  entryPrefix: string;
  periodPrefix: string;
  overtimePrefix: string;
  recoveryUsePrefix: string;
  mecenatPrefix: string;
  shareWithAgnes: boolean;
};

export async function readCalendar(
  context: CalendarReadContext,
): Promise<Response> {
  const {
    email,
    store,
    scopedKey,
    entryPrefix,
    periodPrefix,
    overtimePrefix,
    recoveryUsePrefix,
    mecenatPrefix,
    shareWithAgnes,
  } = context;
  const [
    listed,
    listedPeriods,
    listedOvertime,
    listedRecoveryUses,
    listedMecenat,
    formProfile,
    sharedCalendar,
  ] = await Promise.all([
    listBlobs(store, entryPrefix),
    listBlobs(store, periodPrefix),
    listBlobs(store, overtimePrefix),
    listBlobs(store, recoveryUsePrefix),
    listBlobs(store, mecenatPrefix),
    store.get(scopedKey("form-profile"), {
      type: "json",
    }) as Promise<FormProfile | null>,
    readAgnesSharedCalendar(shareWithAgnes),
  ]);
  const [entries, periods, overtimeEntries, recoveryUses, mecenatEntries] =
    await Promise.all([
      Promise.all(
        listed.blobs.map((blob) => store.get(blob.key, { type: "json" })),
      ),
      Promise.all(
        listedPeriods.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }),
        ),
      ),
      Promise.all(
        listedOvertime.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }),
        ),
      ),
      Promise.all(
        listedRecoveryUses.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }),
        ),
      ),
      Promise.all(
        listedMecenat.blobs.map((blob) =>
          store.get(blob.key, { type: "json" }),
        ),
      ),
    ]);
  const cleanEntries = entries.filter((entry): entry is CalendarEntry =>
    Boolean(entry) && !isCalendarTombstone(entry),
  );
  const cleanPeriods = periods.filter((period): period is LeavePeriod =>
    Boolean(period) && !isCalendarTombstone(period),
  );
  const cleanOvertime = overtimeEntries.filter(
    (item): item is OvertimeEntry => Boolean(item) && !isCalendarTombstone(item),
  );
  const cleanRecoveryUses = recoveryUses.filter(
    (item): item is RecoveryUse => Boolean(item) && !isCalendarTombstone(item),
  );
  const cleanMecenat = mecenatEntries.filter(
    (item): item is MecenatEntry => Boolean(item) && !isCalendarTombstone(item),
  );
  cleanEntries.sort((a, b) => a.date.localeCompare(b.date));
  cleanPeriods.sort((a, b) => a.from.localeCompare(b.from));
  cleanOvertime.sort((a, b) => a.date.localeCompare(b.date));
  cleanRecoveryUses.sort((a, b) => a.date.localeCompare(b.date));
  cleanMecenat.sort((a, b) => a.date.localeCompare(b.date));
  const backfillKey = scopedKey("shared-calendar-backfill-v1");
  const alreadyBackfilled = shareWithAgnes
    ? await store.get(backfillKey, { type: "text" })
    : null;
  if (shareWithAgnes && alreadyBackfilled !== "done") {
    const status = await syncExistingSharedCalendar(
      true,
      cleanEntries as unknown as Array<Record<string, unknown>>,
      cleanPeriods as unknown as Array<Record<string, unknown>>,
    );
    if (status === "shared") await store.set(backfillKey, "done");
  }
  return json({
    email,
    entries: cleanEntries,
    periods: cleanPeriods,
    overtime_entries: cleanOvertime,
    recovery_uses: cleanRecoveryUses,
    mecenat_entries: cleanMecenat,
    form_profile: formProfile && !isCalendarTombstone(formProfile) ? formProfile : null,
    shared_calendar: sharedCalendar,
  });
}
