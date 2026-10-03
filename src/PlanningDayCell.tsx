import type { CSSProperties } from "react";
import type { LeavePeriod, SelectedDay, SharedEntry, WorkExchange } from "./appModel";
import { WORK_POSTS } from "./appModel";
import type { RecoveryUse } from "./overtime";
import { minutesLabel } from "./overtime";
import {
  DAY_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  dateKey,
  getDayInfo,
  halfBalanceOf,
  isCountedOnlyHalfBalance,
  leaveTypeLabel,
  longDate,
  type LeaveType,
  type SchoolVacation,
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
  /** Durée qui libère toute la journée : au-delà, la case passe en repos. */
  fullDayRecoveryMinutes?: number;
  leavePeriod?: LeavePeriod;
  showLeaves: boolean;
  showNotes: boolean;
  inPendingRange: boolean;
  rangeSelecting: boolean;
  /** Couleur des dates choisies dans une sélection de plusieurs dates :
   *  le vert des souhaits, sinon la couleur des congés. */
  rangePreviewColor?: string;
  recoveryRangeSelecting: boolean;
  noteSelecting: boolean;
  noteColor: string;
  exceptionalClosure?: { label: string };
  exchange?: WorkExchange | null;
  workAccident?: boolean;
  agnesLeave?: boolean;
  sharedNoteText?: string;
  schoolVacation?: SchoolVacation;
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
  fullDayRecoveryMinutes = Number.POSITIVE_INFINITY,
  leavePeriod,
  showLeaves,
  showNotes,
  inPendingRange,
  rangeSelecting,
  rangePreviewColor,
  recoveryRangeSelecting,
  noteSelecting,
  noteColor,
  exceptionalClosure,
  exchange,
  workAccident = false,
  agnesLeave = false,
  sharedNoteText = "",
  schoolVacation,
  onClick,
}: PlanningDayCellProps) {
  const info = getDayInfo(date, group);
  const exchangeRole = exchange
    ? entry?.exchangeRole || (exchange.agreementDate === dateKey(date) ? "given" : "return")
    : "";
  const exchangeLabel = exchange
    ? exchangeRole === "given"
      ? `Repos · votre cycle groupe ${group} · remplacé par ${exchange.partnerName}`
      : `Travail · cycle groupe ${exchange.partnerGroup} · remplacement de ${exchange.partnerName}`
    : "";
  const hourlyRecoveryMinutes = recoveryEntries.reduce((total, item) => total + item.minutes, 0);
  const hasHourlyRecovery = hourlyRecoveryMinutes > 0;
  const trainingMinutesOnDay = recoveryEntries
    .filter((item) => item.kind === "training")
    .reduce((total, item) => total + item.minutes, 0);
  const hasTrainingRecovery = trainingMinutesOnDay > 0;
  // Toute la journée posée en heures : la case se lit comme un jour de repos
  // récupéré, et non comme une journée travaillée avec quelques heures.
  const fullHourlyRecovery = hasHourlyRecovery && !hasTrainingRecovery && info.kind !== "off"
    && hourlyRecoveryMinutes >= fullDayRecoveryMinutes;
  const hasLeavePeriod = Boolean(leavePeriod);
  const personalDay = Boolean(showLeaves && entry?.leave);
  const wishDay = Boolean(showLeaves && entry?.wish);
  const visibleLeave = Boolean(showLeaves && hasLeavePeriod && info.kind !== "off");
  const wishOutline = wishDay && info.kind !== "off" && !hasLeavePeriod;
  const myLeaveType = visibleLeave ? leavePeriod?.leaveType || "" : "";
  const myRecovery = myLeaveType === "recovery";
  const myHalfMoment = myLeaveType === "half" ? leavePeriod?.halfMoment || "" : "";
  // Une demi-journée de RTT ou de fractionnement prend la couleur de son solde.
  const myHalfBalance = myLeaveType === "half" && leavePeriod ? halfBalanceOf(leavePeriod) : "annual";
  // Accueil ou billetterie : A ou B, une petite lettre rouge dans le coin ; les
  // salles, poste par défaut, ne se signalent pas.
  const workPost = entry?.workPost && !visibleLeave && !personalDay && !exceptionalClosure && !hasHourlyRecovery
    ? WORK_POSTS.find((post) => post.value === entry.workPost)
    : undefined;
  const markerType = myLeaveType === "half" && isCountedOnlyHalfBalance(myHalfBalance) ? myHalfBalance : myLeaveType;
  const hasMikaNote = Boolean(showNotes && entry?.noteText);
  const hasAgnesNote = Boolean(showNotes && sharedNoteText);
  const visibleNote = hasMikaNote || hasAgnesNote;
  const leaveLabel = [
    visibleLeave
      ? myRecovery
        ? "Récupération"
        : myHalfMoment
          ? `Demi-journée ${myHalfMoment === "morning" ? "matin" : "après-midi"}${myHalfBalance === "rtt" ? " · RTT" : myHalfBalance === "fraction" ? " · fractionnement" : myHalfBalance === "exceptional" ? " · jour exceptionnel" : myHalfBalance === "other" ? " · Divers" : ""}`
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
        : `Récupération en heures (${minutesLabel(hourlyRecoveryMinutes)}${fullHourlyRecovery ? ", journée entière" : ""})`
      : "",
    visibleNote ? "Note enregistrée" : "",
    exceptionalClosure?.label ?? "",
    exchangeLabel,
    workPost?.label ?? "",
    workAccident ? "Accident de travail" : "",
    agnesLeave ? "Congé d’Agnès" : "",
    sharedNoteText ? "Note d’Agnès" : "",
    schoolVacation ? `${schoolVacation.name} · vacances scolaires` : "",
  ].filter(Boolean).join(" — ");
  // Une demi-journée d'ASA ou de Divers se montre sous leur couleur.
  const selectedKind = selected?.type === "half" && isCountedOnlyHalfBalance(selected.halfBalance) ? selected.halfBalance : selected?.type;
  const selectionStyle = selected && selectedKind
    ? ({ "--selection-color": TYPE_COLORS[selectedKind] } as CSSProperties)
    : cleanupSelected
      ? ({ "--selection-color": "#c43d43" } as CSSProperties)
      : rangeSelecting || recoveryRangeSelecting
        ? ({ "--range-preview": recoveryRangeSelecting ? "#f3b3a6" : rangePreviewColor || "var(--leave)" } as CSSProperties)
        : noteSelecting
          ? ({ "--range-preview": noteColor } as CSSProperties)
          : undefined;

  return (
    <button
      type="button"
      className={`${compact ? "mini-day" : "day"} ${info.kind}${date.getDay() === 0 || date.getDay() === 6 ? " weekend" : ""}${visibleLeave && !myRecovery && !myHalfMoment ? ` leave-day leave-${myLeaveType}` : ""}${personalDay ? " personal-day" : ""}${myRecovery || fullHourlyRecovery ? " recovery-day" : ""}${hasHourlyRecovery ? " hourly-recovery-day" : ""}${hasTrainingRecovery ? " training-recovery-day" : ""}${myHalfMoment ? ` half-${myHalfMoment}${myHalfBalance === "annual" ? "" : ` half-${myHalfBalance}`}` : ""}${wishOutline ? " wish-day" : ""}${agnesLeave ? " agnes-leave-day" : ""}${today ? " today" : ""}${visibleNote ? " has-note" : ""}${exceptionalClosure ? " exceptional-closure-day" : ""}${exchange ? ` exchange-day exchange-${exchangeRole}` : ""}${workAccident ? " work-accident-day" : ""}${schoolVacation ? " school-vacation-day" : ""}${selected || cleanupSelected ? " request-selected" : ""}${selected?.type === "strike" ? " request-selected-strike" : ""}${cleanupSelected ? " cleanup-selected" : ""}${inPendingRange ? " range-selected range-edge" : ""}`}
      style={selectionStyle}
      onClick={onClick}
      title={title}
      aria-current={today ? "date" : undefined}
      aria-label={`${longDate(date)}, ${info.holiday ? `${info.holiday}, ` : ""}${exchangeLabel || DAY_LABELS[info.kind]}${selected ? `, ${TYPE_LABELS[selected.type]} sélectionné` : ""}${leaveLabel ? `, ${leaveLabel}` : ""}${hasHourlyRecovery ? hasTrainingRecovery ? `, formation en récupération de ${minutesLabel(trainingMinutesOnDay)}` : `, récupération de ${minutesLabel(hourlyRecoveryMinutes)}${fullHourlyRecovery ? ", journée entière" : ""}` : ""}${visibleNote ? ", note enregistrée" : ""}${exceptionalClosure ? `, ${exceptionalClosure.label}` : ""}${workPost ? `, ${workPost.label.toLowerCase()}` : ""}${workAccident ? ", accident de travail" : ""}${agnesLeave ? ", congé d’Agnès" : ""}${sharedNoteText ? ", note d’Agnès" : ""}${schoolVacation ? `, ${schoolVacation.name}, vacances scolaires` : ""}`}
    >
      <span className={`${info.holiday ? "holiday-date" : "date-number"}${exceptionalClosure ? " exceptional-closure-date" : ""}${agnesLeave ? " agnes-leave-date" : ""}`}>
        {date.getDate()}
      </span>
      {hasHourlyRecovery && !compact ? <span className={`recovery-calendar-label ${hasTrainingRecovery ? "training-recovery-label" : "hourly-recovery-label"}`}>REC</span> : null}
      {visibleLeave && ((!compact && ["annual", "rtt", "fraction"].includes(myLeaveType)) || ["exceptional", "childcare", "sick", "cet", "strike"].includes(markerType)) ? (
        <span className={`leave-calendar-marker leave-calendar-marker-${markerType}${compact ? " compact" : ""}`} aria-hidden="true">
          {myLeaveType === "annual" ? "CA" : myLeaveType === "rtt" ? "RTT" : myLeaveType === "fraction" ? "FRA" : markerType === "exceptional" ? "ASA" : myLeaveType === "childcare" ? "👶" : myLeaveType === "sick" ? "🤒" : myLeaveType === "cet" ? "CET" : myLeaveType === "strike" ? "✊" : ""}
        </span>
      ) : null}
      {(markerType === "other" || personalDay) ? (
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
      {selected && selectedKind && !compact ? <span className="selection-label">{selectedKind !== selected.type ? `½ ${TYPE_LABELS[selectedKind]}` : TYPE_LABELS[selected.type]}{selected.start && selectedKind === selected.type ? ` · ${selected.start}–${selected.end}` : ""}</span> : null}
      {visibleNote ? (
        <span className={`note-band${hasMikaNote && hasAgnesNote ? " dual-note-band" : hasAgnesNote ? " agnes-note-band" : " mika-note-band"}${myHalfMoment ? ` note-band-half-${myHalfMoment}` : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m6 18 1.2-4.3L16.4 4.5l3.1 3.1-9.2 9.2L6 18Z" /><path d="m14.8 6.1 3.1 3.1" /></svg>
        </span>
      ) : null}
      {exceptionalClosure ? <img className={`exceptional-closure-marker${compact ? " compact" : ""}`} src="/exceptional-closure-icon.webp" alt="" aria-hidden="true" title={exceptionalClosure.label} /> : null}
      {exchange ? (
        <>
          {!compact ? (
            <span className="exchange-calendar-label">
              {exchangeRole === "given" ? "OFF" : "TRAVAIL"}
            </span>
          ) : null}
          <img className={`exchange-calendar-marker${compact ? " compact" : ""}`} src="/exchange-arrows.png" alt="" aria-hidden="true" />
        </>
      ) : null}
      {workPost ? <span className={`work-post-marker${compact ? " compact" : ""}`} aria-hidden="true">{workPost.letter}</span> : null}
      {workAccident ? <img className={`work-accident-calendar-marker${compact ? " compact" : ""}`} src="/work-accident-icon.png" alt="" aria-hidden="true" /> : null}
    </button>
  );
}
