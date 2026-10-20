import { useMemo } from "react";
import type {
  BalanceType,
  LeavePeriod,
  ManualYearAdjustments,
  RequestKind,
  SelectedDay,
} from "./appModel";
import { computeLeaveStats } from "./leaveStats";
import { EMPTY_MANUAL_ADJUSTMENTS } from "./payAllowances";
import {
  TYPE_LABELS,
  addDays,
  dateKey,
  fromKey,
  getDayInfo,
  leaveTypeLabel,
  type CountedOnlyType,
} from "./planningLogic";
import { exceededLeaveBalance, type LeaveRemainingByYear } from "./RequestValidationSummary";

type LeaveBalancesInput = {
  /** L'année dont les soldes sont affichés. */
  absenceYear: number;
  now: Date;
  periods: LeavePeriod[];
  group: number;
  manualAdjustments: Record<string, ManualYearAdjustments> | undefined;
  /** Les dates choisies dans la demande en cours, par ordre chronologique. */
  selectedList: SelectedDay[];
  requestKind: RequestKind | null;
  /** Le solde dont le détail est ouvert. */
  balanceDetailType: BalanceType | CountedOnlyType | null;
};

/** Soldes restants d'une année (CA, RTT, fractionnement). Le solde repart au
 *  1er janvier ; du 1er janvier au 30 avril, le reste des CA de l'année
 *  précédente s'ajoute aux CA. */
export function remainingLeaveForYear(
  year: number,
  today: Date,
  periods: Parameters<typeof computeLeaveStats>[0]["periods"],
  group: number,
  manualAdjustments: Parameters<typeof computeLeaveStats>[0]["manualAdjustments"],
) {
  const stats = computeLeaveStats({ year, today, periods, group, manualAdjustments });
  const todayKey = dateKey(today);
  const carry = stats.annualCarry.fromPrevious;
  const carried = carry && todayKey >= `${year}-01-01` && todayKey <= carry.deadline ? carry.remaining : 0;
  return Object.fromEntries(stats.balances.map((balance) => [
    balance.type,
    balance.remaining + (balance.type === "annual" ? carried : 0),
  ])) as LeaveRemainingByYear[string];
}

/**
 * Les soldes de congés de l'année affichée et ce qui en découle : reste de
 * CA reporté jusqu'au 30 avril, soldes par type et par année pour la demande
 * en cours, jours CET posés, et le détail d'un solde ouvert.
 */
export function useLeaveBalances({
  absenceYear,
  now,
  periods,
  group,
  manualAdjustments,
  selectedList,
  requestKind,
  balanceDetailType,
}: LeaveBalancesInput) {
  const leaveStats = useMemo(
    () =>
      computeLeaveStats({
        year: absenceYear,
        today: now,
        periods,
        group,
        manualAdjustments,
      }),
    [periods, absenceYear, group, manualAdjustments, now],
  );

  const activeManualAdjustments =
    manualAdjustments?.[String(absenceYear)] ??
    EMPTY_MANUAL_ADJUSTMENTS;
  const manualSundayLeaveTotal =
    activeManualAdjustments.sundayLeaveJanJun +
    activeManualAdjustments.sundayLeaveJulSep +
    activeManualAdjustments.sundayLeaveOctNov +
    activeManualAdjustments.sundayLeaveDec;

  // Totaux des seuls congés à quota : la maladie n'y entre pas.
  // Du 1er janvier au 30 avril, le reste des CA de l'année précédente
  // s'ajoute ; avant, il est encore compté dans sa propre année.
  const carryWindowOpen = Boolean(
    leaveStats.annualCarry.fromPrevious &&
      dateKey(now) >= `${absenceYear}-01-01` &&
      dateKey(now) <= leaveStats.annualCarry.fromPrevious.deadline,
  );
  const carriedAnnualRemaining = carryWindowOpen && leaveStats.annualCarry.fromPrevious
    ? leaveStats.annualCarry.fromPrevious.remaining
    : 0;
  const totalLeaveRemaining = leaveStats.balances.reduce(
    (total, balance) => total + balance.remaining,
    carriedAnnualRemaining,
  );
  const cetLeaveBalances = {
    annual:
      leaveStats.balances.find((balance) => balance.type === "annual")?.remaining || 0,
    rtt:
      leaveStats.balances.find((balance) => balance.type === "rtt")?.remaining || 0,
    fraction:
      leaveStats.balances.find((balance) => balance.type === "fraction")?.remaining || 0,
  };
  const leaveRemainingByType = Object.fromEntries(
    leaveStats.balances.map((balance) => [
      balance.type,
      balance.remaining + (balance.type === "annual" ? carriedAnnualRemaining : 0),
    ]),
  ) as Partial<Record<BalanceType, number>>;
  // Le solde repart au 1er janvier : chaque date compte sur le solde de son
  // année, même posée à l'avance (une date de 2027 choisie en 2026).
  const selectedYears = [...new Set(selectedList.map((item) => item.date.slice(0, 4)))].sort().join(",");
  const leaveRemainingByYear = useMemo(
    () => Object.fromEntries(selectedYears.split(",").filter(Boolean).map((yearKey) => [
      yearKey,
      remainingLeaveForYear(Number(yearKey), now, periods, group, manualAdjustments),
    ])) as LeaveRemainingByYear,
    [selectedYears, now, periods, group, manualAdjustments],
  );
  const leaveSelectionOverBalance = requestKind === "leave" && Boolean(
    exceededLeaveBalance(selectedList, group, leaveRemainingByType, leaveRemainingByYear),
  );
  const cetAnnualDaysTaken =
    leaveStats.balances.find((balance) => balance.type === "annual")?.used || 0;
  const cetPlannedLeaveDays = useMemo(() => {
    const dates = new Set<string>();
    for (const period of periods) {
      if (period.leaveType !== "cet") continue;
      for (let date = fromKey(period.from); dateKey(date) <= period.to; date = addDays(date, 1)) {
        const info = getDayInfo(date, period.group || group);
        if (!info.holiday && info.kind !== "off") dates.add(dateKey(date));
      }
    }
    return dates.size;
  }, [periods, group]);
  const balanceDetail = useMemo(() => {
    if (!balanceDetailType) return null;
    if (balanceDetailType !== "annual" && balanceDetailType !== "rtt" &&
      balanceDetailType !== "fraction") {
      const counted = leaveStats.countedOnly[balanceDetailType];
      return {
        title: TYPE_LABELS[balanceDetailType],
        quota: false,
        allowance: 0,
        manualUsed: 0,
        remaining: 0,
        used: counted.used,
        details: counted.details,
      };
    }
    const balance = leaveStats.balances.find(
      (item) => item.type === balanceDetailType,
    );
    return balance
      ? { title: leaveTypeLabel(balance.type), quota: true, ...balance }
      : null;
  }, [balanceDetailType, leaveStats]);
  const recentBalanceDetailDates = useMemo(
    () =>
      new Set(
        (balanceDetail?.details ?? [])
          .map((detail) => detail.date)
          .sort((a, b) => b.localeCompare(a))
          .slice(0, 3),
      ),
    [balanceDetail],
  );
  const balanceDetailPeriods = useMemo(() => {
    const todayKey = dateKey(now);
    const details = balanceDetail?.details ?? [];
    return [
      {
        key: "taken",
        label: "Congés déjà pris",
        details: details
          .filter((detail) => detail.date <= todayKey)
          .sort((a, b) => b.date.localeCompare(a.date)),
      },
      {
        key: "upcoming",
        label: "Congés à venir",
        details: details
          .filter((detail) => detail.date > todayKey)
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
    ].map((period) => ({
      ...period,
      units: period.details.reduce((total, detail) => total + detail.units, 0),
    }));
  }, [balanceDetail, now]);

  return {
    leaveStats,
    activeManualAdjustments,
    manualSundayLeaveTotal,
    carryWindowOpen,
    carriedAnnualRemaining,
    totalLeaveRemaining,
    cetLeaveBalances,
    leaveRemainingByType,
    leaveRemainingByYear,
    leaveSelectionOverBalance,
    cetAnnualDaysTaken,
    cetPlannedLeaveDays,
    balanceDetail,
    recentBalanceDetailDates,
    balanceDetailPeriods,
  };
}
