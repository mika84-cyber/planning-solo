import type { LeavePeriod } from "./appModel";
import { rangeKeys } from "./appModel";
import { groupConsecutive, sickLeaveDeduction } from "./planningLogic";

export function sickLeaveSummaryForYear(
  periods: LeavePeriod[],
  year: number,
  baseSalary: number,
  ifse: number,
  carenceDay: number,
) {
  const yearText = String(year);
  const sickDays = new Set<string>();
  for (const period of periods) {
    if (period.leaveType !== "sick") continue;
    for (const key of rangeKeys(period.from, period.to)) sickDays.add(key);
  }
  const episodes = groupConsecutive([...sickDays]);
  const perDay = sickLeaveDeduction(2, baseSalary, ifse, carenceDay).perDay;
  const byMonth = Array.from({ length: 12 }, () => ({ days: 0, total: 0 }));
  const arrets = episodes.flatMap((episode) => {
    const allDays = rangeKeys(episode.from, episode.to);
    const displayedDays = allDays.filter((key) => key.startsWith(`${yearText}-`));
    if (!displayedDays.length) return [];
    let carence = 0;
    let reducedDays = 0;
    let reduction = 0;
    for (const key of displayedDays) {
      const slot = byMonth[Number(key.slice(5, 7)) - 1];
      slot.days += 1;
      if (key === episode.from) {
        slot.total += carenceDay;
        carence += carenceDay;
      } else {
        slot.total += perDay;
        reducedDays += 1;
        reduction += perDay;
      }
    }
    return [{
      id: episode.from,
      from: episode.from,
      to: episode.to,
      days: displayedDays.length,
      carence,
      reducedDays,
      perDay,
      reduction,
      total: carence + reduction,
    }];
  }).sort((a, b) => a.from.localeCompare(b.from));

  return {
    arrets,
    byMonth,
    days: arrets.reduce((total, episode) => total + episode.days, 0),
    total: arrets.reduce((total, episode) => total + episode.total, 0),
  };
}
