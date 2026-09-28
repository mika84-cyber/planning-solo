import type { Dispatch, SetStateAction } from "react";
import { emptyEntry, type Entries, type LeavePeriod, type SharedEntry, type WorkPost } from "./appModel";
import { fromKey, getDayInfo } from "./planningLogic";

/** Le poste (salles, accueil, billetterie) ne se choisit que sur une
 *  journée réellement travaillée : ni congé, ni récupération, ni fermeture,
 *  ni jour cédé lors d'un échange. Un jour repris par échange compte. */
export function canChooseWorkPost({
  date,
  group,
  entries,
  periods,
  recoveryUses,
  closed,
}: {
  date: string;
  group: number;
  entries: Entries;
  periods: ReadonlyArray<Pick<LeavePeriod, "from" | "to">>;
  recoveryUses: ReadonlyArray<{ date: string }>;
  closed: boolean;
}) {
  const entry = entries[date];
  if (closed || entry?.leave) return false;
  if (periods.some((period) => date >= period.from && date <= period.to)) return false;
  if (recoveryUses.some((use) => use.date === date)) return false;
  if (entry?.exchangeRole === "given") return false;
  if (entry?.exchangeRole === "return") return true;
  return getDayInfo(fromKey(date), group).kind === "work";
}

/** Poste du jour : affiché tout de suite et fiche refermée, puis enregistré
 *  sans relire tout le calendrier. En cas d'échec, la journée revient à son
 *  état d'avant, un message l'annonce et le calendrier est relu. */
export async function saveWorkPostOptimistically({
  date,
  workPost,
  entries,
  setEntries,
  closeDay,
  demoMode,
  post,
  notify,
  reload,
}: {
  date: string;
  workPost: WorkPost | "";
  entries: Entries;
  setEntries: Dispatch<SetStateAction<Entries>>;
  closeDay: () => void;
  demoMode: boolean;
  post: (payload: Record<string, unknown>) => Promise<{ deleted?: boolean; updatedAt?: string }>;
  notify: (error: unknown) => void;
  reload: () => Promise<void>;
}) {
  const previous = entries[date];
  const current = previous || emptyEntry();
  const chosen: SharedEntry = { ...current, workPost };
  const worthKeeping = (entry: SharedEntry) => Boolean(
    entry.noteText || entry.leave || entry.wish || entry.holidayPay || entry.closureOverride || entry.workPost || entry.exchangeId,
  );
  const show = (entry: SharedEntry | undefined) => setEntries((all) => {
    const next = { ...all };
    if (entry && worthKeeping(entry)) next[date] = entry;
    else delete next[date];
    return next;
  });
  show(chosen);
  closeDay();
  if (demoMode) return;
  try {
    const saved = await post({ action: "save-entry", date, ...chosen, expectedUpdatedAt: current.updatedAt });
    if (!saved.deleted && saved.updatedAt) show({ ...chosen, updatedAt: saved.updatedAt });
  } catch (error) {
    show(previous);
    notify(error);
    await reload().catch(() => undefined);
  }
}
