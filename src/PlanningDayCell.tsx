import type { CSSProperties } from "react";
import type { LeavePeriod, SelectedDay, SharedEntry } from "./appModel";
import type { RecoveryUse } from "./overtime";
import { minutesLabel } from "./overtime";
import {
  DAY_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  getDayInfo,
  leaveTypeLabel,
  longDate,
  type LeaveType,
} from "./planningLogic";

type PlanningDayCellProps = {
  date: Date;
  group: number;
  compact?: boolean;
  entry?: SharedEntry;
  selected?: SelectedDay;
  cleanupSelected: boolean;
  today: boolean;
  recoveryEntries: RecoveryUse[];
  leavePeriod?: LeavePeriod;
  showLeaves: boolean;
  showNotes: boolean;
  inPendingRange: boolean;
  rangeSelecting: boolean;
  recoveryRangeSelecting: boolean;
  noteSelecting: boolean;
  noteColor: string;
  exceptionalClosure?: { label: string };
  onClick: () => void;
};

export function PlanningDayCell({
  date,
  group,
  compact = false,
  entry,
  selected,
  cleanupSelected,
  today,
  recoveryEntries,
  leavePeriod,
  showLeaves,
  showNotes,
  inPendingRange,
  rangeSelecting,
  recoveryRangeSelecting,
  noteSelecting,
  noteColor,
  exceptionalClosure,
  onClick,
}: PlanningDayCellProps) {
  const info = getDayInfo(date, group);
  const hourlyRecoveryMinutes = recoveryEntries.reduce((total, item) => total + item.minutes, 0);
  const hasHourlyRecovery = hourlyRecoveryMinutes > 0;
  const trainingMinutesOnDay = recoveryEntries
    .filter((item) => item.kind === "training")
    .reduce((total, item) => total + item.minutes, 0);
  const hasTrainingRecovery = trainingMinutesOnDay > 0;
  const hasLeavePeriod = Boolean(leavePeriod);
  const personalDay = Boolean(showLeaves && entry?.leave);
  const wishDay = Boolean(showLeaves && entry?.wish);
  const visibleLeave = Boolean(showLeaves && hasLeavePeriod && info.kind !== "off");
  const wishOutline = wishDay && info.kind !== "off" && !hasLeavePeriod;
  const myLeaveType = visibleLeave ? leavePeriod?.leaveType || "" : "";
  const myRecovery = myLeaveType === "recovery";
  const myHalfMoment = myLeaveType === "half" ? leavePeriod?.halfMoment || "" : "";
  const visibleNote = Boolean(showNotes && entry?.noteText);
  const leaveLabel = [
    visibleLeave
      ? myRecovery
        ? "Récupération"
        : myHalfMoment
          ? `Demi-journée ${myHalfMoment === "morning" ? "matin" : "après-midi"}`
          : leaveTypeLabel(myLeaveType as LeaveType)
      : "",
    personalDay ? "Divers" : "",
  ].filter(Boolean).join(" · ");
  const title = [
    info.holiday,
    DAY_LABELS[info.kind],
    selected ? TYPE_LABELS[selected.type] : "",
    leaveLabel,
    hasHourlyRecovery
      ? hasTrainingRecovery
        ? `Formation en récupération (${minutesLabel(trainingMinutesOnDay)})`
        : `Récupération en heures (${minutesLabel(hourlyRecoveryMinutes)})`
      : "",
    visibleNote ? "Note enregistrée" : "",
    exceptionalClosure?.label ?? "",
  ].filter(Boolean).join(" — ");
  const selectionStyle = selected
    ? ({ "--selection-color": TYPE_COLORS[selected.type] } as CSSProperties)
    : cleanupSelected
      ? ({ "--selection-color": "#c43d43" } as CSSProperties)
      : rangeSelecting || recoveryRangeSelecting
        ? ({ "--range-preview": recoveryRangeSelecting ? "#f3b3a6" : "var(--leave)" } as CSSProperties)
        : noteSelecting
          ? ({ "--range-preview": noteColor } as CSSProperties)
          : undefined;

  return (
    <button
      type="button"
      className={`${compact ? "mini-day" : "day"} ${info.kind}${date.getDay() === 0 || date.getDay() === 6 ? " weekend" : ""}${visibleLeave && !myRecovery && !myHalfMoment ? ` leave-day leave-${myLeaveType}` : ""}${personalDay ? " personal-day" : ""}${myRecovery ? " recovery-day" : ""}${hasHourlyRecovery ? " hourly-recovery-day" : ""}${hasTrainingRecovery ? " training-recovery-day" : ""}${myHalfMoment ? ` half-${myHalfMoment}` : ""}${wishOutline ? " wish-day" : ""}${today ? " today" : ""}${visibleNote ? " has-note" : ""}${selected || cleanupSelected ? " request-selected" : ""}${selected?.type === "strike" ? " request-selected-strike" : ""}${cleanupSelected ? " cleanup-selected" : ""}${inPendingRange ? " range-selected range-edge" : ""}`}
      style={selectionStyle}
      onClick={onClick}
      title={title}
      aria-current={today ? "date" : undefined}
      aria-label={`${longDate(date)}, ${info.holiday ? `${info.holiday}, ` : ""}${DAY_LABELS[info.kind]}${selected ? `, ${TYPE_LABELS[selected.type]} sélectionné` : ""}${leaveLabel ? `, ${leaveLabel}` : ""}${hasHourlyRecovery ? hasTrainingRecovery ? `, formation en récupération de ${minutesLabel(trainingMinutesOnDay)}` : `, récupération de ${minutesLabel(hourlyRecoveryMinutes)}` : ""}${visibleNote ? ", note enregistrée" : ""}${exceptionalClosure ? `, ${exceptionalClosure.label}` : ""}`}
    >
      <span className={`${info.holiday ? "holiday-date" : "date-number"}${exceptionalClosure ? " exceptional-closure-date" : ""}`}>{date.getDate()}</span>
      {hasHourlyRecovery && !compact ? <span className={`recovery-calendar-label ${hasTrainingRecovery ? "training-recovery-label" : "hourly-recovery-label"}`}>REC</span> : null}
      {visibleLeave && ((!compact && ["annual", "rtt", "fraction"].includes(myLeaveType)) || ["exceptional", "childcare", "sick", "cet", "strike"].includes(myLeaveType)) ? (
        <span className={`leave-calendar-marker leave-calendar-marker-${myLeaveType}${compact ? " compact" : ""}`} aria-hidden="true">
          {myLeaveType === "annual" ? "CA" : myLeaveType === "rtt" ? "RTT" : myLeaveType === "fraction" ? "FRA" : myLeaveType === "exceptional" ? "ASA" : myLeaveType === "childcare" ? "👶" : myLeaveType === "sick" ? "🤒" : myLeaveType === "cet" ? "CET" : myLeaveType === "strike" ? "✊" : ""}
        </span>
      ) : null}
      {(myLeaveType === "other" || personalDay) ? (
        <span className={`other-pin${compact ? " compact" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 30 30">
            <path className="other-pin-needle" d="m13.5 18.2-2.2 10.3 5.3-10.9Z" />
            <path className="other-pin-body" d="M10 7.2h8l-1.1 7.1 3.5 2.6c1 .7.6 2.2-.6 2.4L9.2 20.8c-1.2.2-2-.9-1.4-2l2.9-3.4L10 7.2Z" />
            <ellipse className="other-pin-head" cx="14" cy="7" rx="6.4" ry="3.8" />
            <path className="other-pin-highlight" d="M10.7 5.9c1.6-1.3 4.5-1.7 6.5-.5" />
          </svg>
        </span>
      ) : null}
      {(selected || cleanupSelected) ? <span className="selection-corner" aria-hidden="true" /> : null}
      {selected && !compact ? <span className="selection-label">{TYPE_LABELS[selected.type]}{selected.start ? ` · ${selected.start}–${selected.end}` : ""}</span> : null}
      {visibleNote ? (
        <span className={`note-band${myHalfMoment ? ` note-band-half-${myHalfMoment}` : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m6 18 1.2-4.3L16.4 4.5l3.1 3.1-9.2 9.2L6 18Z" /><path d="m14.8 6.1 3.1 3.1" /></svg>
        </span>
      ) : null}
      {exceptionalClosure ? <img className={`exceptional-closure-marker${compact ? " compact" : ""}`} src="/exceptional-closure-icon.webp" alt="" aria-hidden="true" title={exceptionalClosure.label} /> : null}
    </button>
  );
}
