import { visibleAbsencePeriod } from "./absenceReplacement";
import { workExchangeForDate } from "./workExchange";
import { minutesLabel, type RecoveryUse } from "./overtime";
import type { Entries, LeavePeriod, SelectedDay } from "./appModel";
import { personalPresenceForDate } from "./appModel";
import {
  DAY_LABELS,
  coWorkingGroupsForDate,
  dateKey,
  getDayInfo,
  leaveTypeLabel,
  nextAttendanceDay,
  selectionRemovesAttendance,
} from "./planningLogic";

export type TodayOverviewInput = {
  today: Date;
  group: number;
  periods: LeavePeriod[];
  entries: Entries;
  recoveryUses: RecoveryUse[];
  selections: Record<string, SelectedDay>;
  /** Durée d'une journée de travail selon la quotité, en minutes. */
  workDayMinutes: number;
  isExceptionallyClosed: (key: string) => boolean;
};

/** Ce que dit la carte d'accueil : la journée en cours et la prochaine
 *  journée travaillée, échanges, récupérations et fermetures compris. */
export function computeTodayOverview({
  today,
  group,
  periods,
  entries,
  recoveryUses,
  selections,
  workDayMinutes,
  isExceptionallyClosed,
}: TodayOverviewInput) {
  const key = dateKey(today);
  const info = getDayInfo(today, group);
  const coWorkingGroups = coWorkingGroupsForDate(today, group);
  const coWorkingLabel =
    coWorkingGroups.length === 1
      ? `avec le groupe ${coWorkingGroups[0]}`
      : coWorkingGroups.length > 1
        ? `avec les groupes ${coWorkingGroups.join(" et ")}`
        : "sans autre groupe programmé";
  const period = visibleAbsencePeriod(periods, key);
  const entry = entries[key];
  const todayExchange = workExchangeForDate(entries, key);
  const todayRecoveryMinutes = recoveryUses
    .filter((item) => item.date === key)
    .reduce((total, item) => total + item.minutes, 0);
  const todayExceptionalClosure = isExceptionallyClosed(key);
  const scheduledStatus =
    info.kind === "work"
      ? DAY_LABELS[info.kind]
      : DAY_LABELS[info.kind];
  let status = scheduledStatus;
  let tone: string = info.kind;
  if (todayExceptionalClosure && info.kind === "work") {
    status = "Fermeture exceptionnelle";
    tone = "off";
  } else if (todayExchange) {
    status = entry?.exchangeRole === "given"
      ? `Repos · remplacé par ${todayExchange.partnerName}`
      : `Travail · remplacement de ${todayExchange.partnerName}`;
    tone = "exchange";
  } else if (todayRecoveryMinutes) {
    status =
      todayRecoveryMinutes >= workDayMinutes
        ? `Récupération · ${minutesLabel(todayRecoveryMinutes)}`
        : `${scheduledStatus} + récup. ${minutesLabel(todayRecoveryMinutes)}`;
    tone = "recovery";
  } else if (period && info.kind !== "off") {
    status =
      period.leaveType === "half"
        ? `1/2 journée posée ${period.halfMoment === "afternoon" ? "l’après-midi" : "le matin"}`
      : period.leaveType === "other"
        ? "Divers"
        : period.leaveType === "strike"
          ? "Grève"
        : leaveTypeLabel(period.leaveType || "annual");
    tone = period.leaveType === "recovery" ? "recovery" : "leave";
  } else if (entry?.leave) {
    status = "Divers";
    tone = "leave";
  } else if (info.holiday) {
    status = `${scheduledStatus} · ${info.holiday}`;
  }

  const nextWork = nextAttendanceDay(today, group, (candidateKey) => {
    if (isExceptionallyClosed(candidateKey)) {
      return true;
    }
    return entries[candidateKey]?.exchangeRole === "given" ||
      Boolean(entries[candidateKey]?.leave) ||
      Boolean(
        selections[candidateKey] &&
        selections[candidateKey].type !== "half" &&
        selectionRemovesAttendance(selections[candidateKey].type),
      ) ||
      periods.some(
        (item) =>
          item.leaveType !== "half" &&
          candidateKey >= item.from &&
          candidateKey <= item.to,
      ) ||
      personalPresenceForDate(new Date(`${candidateKey}T12:00:00`), group, periods, entries, recoveryUses, workDayMinutes).status === "absence";
  }, 366, (candidateKey) => entries[candidateKey]?.exchangeRole === "return");
  const nextWorkKind = nextWork ? getDayInfo(nextWork, group).kind : null;
  const nextWorkExceptionalClosure = nextWork
    ? isExceptionallyClosed(dateKey(nextWork))
    : undefined;
  const nextWorkExchange = nextWork
    ? workExchangeForDate(entries, dateKey(nextWork))
    : null;
  const nextWorkHalfLeave = nextWork
    ? periods.find((item) =>
        item.leaveType === "half" &&
        dateKey(nextWork) >= item.from &&
        dateKey(nextWork) <= item.to,
      )
    : null;
  const nextWorkHalfLeaveLabel = nextWorkHalfLeave
    ? `1/2 journée posée ${nextWorkHalfLeave.halfMoment === "afternoon" ? "l’après-midi" : "le matin"}`
    : "";
  const nextWorkGroups = nextWork
    ? coWorkingGroupsForDate(nextWork, group)
    : [];
  const nextWorkGroupLabel = nextWorkExchange
    ? entries[dateKey(nextWork!)]?.exchangeRole === "return"
      ? `Remplacement de ${nextWorkExchange.partnerName}`
      : `Remplacé par ${nextWorkExchange.partnerName}`
    : nextWorkExceptionalClosure
    ? "Journée normalement prévue au cycle"
    : nextWorkGroups.length === 1
    ? `Avec le groupe ${nextWorkGroups[0]}`
    : nextWorkGroups.length > 1
      ? `Avec les groupes ${nextWorkGroups.join(" et ")}`
      : nextWorkKind === "work"
        ? "Sans autre groupe programmé"
        : "";
  const isTodayOther =
    period?.leaveType === "other" || Boolean(entry?.leave);

  return {
    status: isTodayOther ? "Je ne travaille pas" : status,
    tone,
    todayGroupLabel:
      info.kind === "work" &&
      !todayExceptionalClosure &&
      !todayExchange &&
      (!period || period.leaveType === "half") &&
      !entry?.leave &&
      todayRecoveryMinutes < workDayMinutes
        ? coWorkingLabel.charAt(0).toUpperCase() + coWorkingLabel.slice(1)
        : "",
    nextWork,
    nextWorkKind,
    nextWorkExceptionalClosure: Boolean(nextWorkExceptionalClosure),
    nextWorkGroupLabel,
    nextWorkHalfLeaveLabel,
  };
}
