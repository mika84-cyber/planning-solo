import { getStore } from "@netlify/blobs";
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

type CalendarReadContext = {
  email: string;
  store: ReturnType<typeof getStore>;
  scopedKey: (key: string) => string;
  entryPrefix: string;
  periodPrefix: string;
  overtimePrefix: string;
  recoveryUsePrefix: string;
  mecenatPrefix: string;
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
  } = context;
  const [
    listed,
    listedPeriods,
    listedOvertime,
    listedRecoveryUses,
    listedMecenat,
    formProfile,
  ] = await Promise.all([
    listBlobs(store, entryPrefix),
    listBlobs(store, periodPrefix),
    listBlobs(store, overtimePrefix),
    listBlobs(store, recoveryUsePrefix),
    listBlobs(store, mecenatPrefix),
    store.get(scopedKey("form-profile"), {
      type: "json",
    }) as Promise<FormProfile | null>,
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
    Boolean(entry),
  );
  const cleanPeriods = periods.filter((period): period is LeavePeriod =>
    Boolean(period),
  );
  const cleanOvertime = overtimeEntries.filter(
    (item): item is OvertimeEntry => Boolean(item),
  );
  const cleanRecoveryUses = recoveryUses.filter(
    (item): item is RecoveryUse => Boolean(item),
  );
  const cleanMecenat = mecenatEntries.filter(
    (item): item is MecenatEntry => Boolean(item),
  );
  cleanEntries.sort((a, b) => a.date.localeCompare(b.date));
  cleanPeriods.sort((a, b) => a.from.localeCompare(b.from));
  cleanOvertime.sort((a, b) => a.date.localeCompare(b.date));
  cleanRecoveryUses.sort((a, b) => a.date.localeCompare(b.date));
  cleanMecenat.sort((a, b) => a.date.localeCompare(b.date));
  return json({
    email,
    entries: cleanEntries,
    periods: cleanPeriods,
    overtime_entries: cleanOvertime,
    recovery_uses: cleanRecoveryUses,
    mecenat_entries: cleanMecenat,
    form_profile: formProfile || null,
  });
}
