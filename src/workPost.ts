import type { Entries, LeavePeriod } from "./appModel";
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
