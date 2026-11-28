import { useEffect, useState, type CSSProperties, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import type { BalanceType, RequestKind, SelectedDay } from "./appModel";
import { ClockTimePicker } from "./ClockTimePicker";
import { isOffSeasonDate, usesFractionRule } from "./fractionRules";
import { MonthNavigation } from "./MonthNavigation";
import { minutesLabel, recoveryRequestMinutes, type RecoveryRequestType, type WorkQuota } from "./overtime";
import {
  DURATION_LEAVE_TYPES,
  TYPE_COLORS,
  TYPE_LABELS,
  dateKey,
  fromKey,
  getDayInfo,
  halfBalanceOf,
  halfMomentFromStart,
  localDate,
  longDate,
  periodTypeLabel,
  s,
  type LeaveHours,
  type LeaveMoment,
  type SelectionType,
} from "./planningLogic";
import {
  exceededLeaveBalance,
  leaveBalanceShortageMessage,
  recoveryBalanceShortageMessage,
  requestLeaveBalanceUsage,
  requestRecoveryMinutes,
  type LeaveRemainingByYear,
} from "./RequestValidationSummary";
import "./leaveRequestWindow.css";

const LEAVE_MENU_TYPES: Array<{ type: SelectionType; label: string; short: string; balanceKey?: BalanceType | "cet" }> = [
  { type: "annual", label: "Congés annuels (CA)", short: "CA", balanceKey: "annual" },
  { type: "rtt", label: "RTT", short: "RTT", balanceKey: "rtt" },
  { type: "fraction", label: "Fractionnement", short: "Fract.", balanceKey: "fraction" },
  { type: "cet", label: "Compte épargne-temps (CET)", short: "CET", balanceKey: "cet" },
  { type: "childcare", label: "Garde d’enfant", short: "Garde" },
  { type: "exceptional", label: "Jour exceptionnel", short: "Excep." },
];

const OTHER_ABSENCE_MENU_TYPES: Array<{ kind: RequestKind; type: SelectionType; label: string; short: string; sick?: boolean }> = [
  { kind: "recovery", type: "recovery_day", label: "Récupération", short: "Récupération" },
  { kind: "leave", type: "sick", label: "Arrêt maladie", short: "Maladie", sick: true },
  { kind: "other", type: "other", label: "Divers", short: "Divers" },
  { kind: "strike", type: "strike", label: "Grève", short: "Grève" },
];

const RECOVERY_MENU_TYPES: Array<{ type: SelectionType; label: string; short: string }> = [
  { type: "recovery_day", label: "Journée entière", short: "Journée" },
  { type: "recovery_half", label: "Demi-journée", short: "½ journée" },
  { type: "recovery_hours", label: "En heures", short: "En heures" },
  { type: "recovery_holiday", label: "Récup. jour férié", short: "Férié" },
  { type: "recovery_training", label: "Récup. formation", short: "Formation" },
];

const WEEKDAYS: Array<[string, string]> = [
  ["mon", "L"],
  ["tue", "M"],
  ["wed", "M"],
  ["thu", "J"],
  ["fri", "V"],
  ["sat", "S"],
  ["sun", "D"],
];

function buildMonthCells(year: number, month: number): Array<{ key: string; date: Date | null }> {
  const first = localDate(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const totalDays = localDate(year, month + 1, 0).getDate();
  const cells: Array<{ key: string; date: Date | null }> = Array.from({ length: leading }, (_, i) => ({
    key: `empty-${year}-${month}-${i}`,
    date: null,
  }));
  for (let day = 1; day <= totalDays; day += 1) {
    const date = localDate(year, month, day);
    cells.push({ key: dateKey(date), date });
  }
  return cells;
}

function shortDayLabel(key: string) {
  const text = fromKey(key).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function tinyChipDate(key: string) {
  return fromKey(key).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function chipTypeLabel(item: SelectedDay, workQuota: WorkQuota) {
  if (item.type === "half") {
    const halfMoment = item.halfMoment ?? (item.start ? halfMomentFromStart(item.start) : "morning");
    const balance = halfBalanceOf(item);
    const short = balance === "rtt" ? "RTT" : balance === "fraction" ? "Fract." : "CA";
    return `½ ${short} ${halfMoment === "afternoon" ? "PM" : "AM"}`;
  }
  if (item.type.startsWith("recovery_")) {
    return minutesLabel(recoveryRequestMinutes(item.type as RecoveryRequestType, workQuota, item.start, item.end));
  }
  const shortByType: Partial<Record<SelectionType, string>> = {
    annual: "CA",
    rtt: "RTT",
    fraction: "Fract.",
    cet: "CET",
    childcare: "Garde",
    exceptional: "Jour exceptionnel",
    sick: "Maladie",
    other: "Divers",
    strike: "Grève",
  };
  return shortByType[item.type] ?? TYPE_LABELS[item.type];
}

function selectionColor(item: SelectedDay) {
  if (item.type === "half") {
    const balance = halfBalanceOf(item);
    return TYPE_COLORS[balance] ?? TYPE_COLORS.annual;
  }
  return TYPE_COLORS[item.type] ?? TYPE_COLORS.annual;
}

function sameRibbonGroup(a: SelectedDay | undefined, b: SelectedDay | undefined) {
  if (!a || !b) return false;
  return a.type === b.type && (a.type !== "half" || halfBalanceOf(a) === halfBalanceOf(b));
}

function prevDateKey(date: Date) {
  return dateKey(localDate(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

function nextDateKey(date: Date) {
  return dateKey(localDate(date.getFullYear(), date.getMonth(), date.getDate() + 1));
}

export type LeaveRequestWindowProps = {
  requestKind: RequestKind;
  sickRequest: boolean;
  activeType: SelectionType;
  leaveMoment: LeaveMoment;
  leaveHours: LeaveHours;
  view: Date;
  now: Date;
  group: number;
  workQuota: WorkQuota;
  selectedList: SelectedDay[];
  leaveRemainingByType: Partial<Record<BalanceType, number>>;
  leaveRemainingByYear?: LeaveRemainingByYear;
  cetRemaining?: number;
  recoveryBalanceRemaining: number;
  savingRequest: boolean;
  selectionBlocked: boolean;
  calendarSlide: string;
  hasExistingAbsence?: (date: string) => boolean;
  onStepMonth: (direction: number) => void;
  onSelectMonth: (year: number, month: number) => void;
  onToday: () => void;
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
  onSelectDay: (date: Date) => void;
  onSelectLeaveType: (type: SelectionType) => void;
  onSelectLeaveMoment: (moment: LeaveMoment) => void;
  onSelectLeaveHours: (hours: LeaveHours) => void;
  onSelectRecoveryType: (type: SelectionType) => void;
  onSwitchRequest?: (kind: RequestKind, type: SelectionType) => void;
  onRemoveDate: (date: string) => void;
  onClearDates: () => void;
  onValidateAndOpenForm: () => void;
  onSaveToPlanning: () => void;
  onCancel: () => void;
};

/**
 * Nouvelle fenêtre condensée « Éditorial Fluide » (Proposition 3) :
 * menus rapides de type et durée, cartouche Début → Fin, calendrier compact,
 * choix Formulaire / Planning seul et validation en un seul écran.
 */
export function LeaveRequestWindow({
  requestKind,
  sickRequest,
  activeType,
  leaveMoment,
  leaveHours,
  view,
  now,
  group,
  workQuota,
  selectedList,
  leaveRemainingByType,
  leaveRemainingByYear,
  cetRemaining,
  recoveryBalanceRemaining,
  savingRequest,
  selectionBlocked,
  calendarSlide,
  hasExistingAbsence,
  onStepMonth,
  onSelectMonth,
  onToday,
  onTouchStart,
  onTouchEnd,
  onSelectDay,
  onSelectLeaveType,
  onSelectLeaveMoment,
  onSelectLeaveHours,
  onSelectRecoveryType,
  onSwitchRequest,
  onRemoveDate,
  onClearDates,
  onValidateAndOpenForm,
  onSaveToPlanning,
  onCancel,
}: LeaveRequestWindowProps) {
  const [openMenu, setOpenMenu] = useState<"type" | "duration" | null>(null);
  const [saveTarget, setSaveTarget] = useState<"form" | "planning">("form");
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".modal-backdrop")) return;
      if (openMenu) {
        event.preventDefault();
        setOpenMenu(null);
        return;
      }
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openMenu, onCancel]);

  if (typeof document === "undefined") return null;

  const yearKey = String(view.getFullYear());
  const selectedByDate = new Map(selectedList.map((item) => [item.date, item]));
  const todayKey = dateKey(now);
  const cells = buildMonthCells(view.getFullYear(), view.getMonth());
  const activeColor = TYPE_COLORS[activeType] ?? TYPE_COLORS.annual;

  // Soldes en direct pour l'année affichée.
  const yearBalances = leaveRemainingByYear?.[yearKey] ?? leaveRemainingByType;
  const usageAll = requestLeaveBalanceUsage(selectedList, group);
  const usageInViewYear = requestLeaveBalanceUsage(
    selectedList.filter((item) => item.date.startsWith(yearKey)),
    group,
  );
  const selectedCetDays = selectedList.filter((item) => {
    if (item.type !== "cet") return false;
    const info = getDayInfo(fromKey(item.date), group);
    return !info.holiday && info.kind !== "off";
  }).length;
  const totalDeductedDays = usageAll.annual + usageAll.rtt + usageAll.fraction + selectedCetDays;
  const recoveryMinutes = requestKind === "recovery" ? requestRecoveryMinutes(selectedList, workQuota) : 0;

  const remainingFor = (balanceKey?: BalanceType | "cet") => {
    if (!balanceKey) return undefined;
    if (balanceKey === "cet") return cetRemaining === undefined ? undefined : Math.round((cetRemaining - selectedCetDays) * 100) / 100;
    const base = yearBalances[balanceKey];
    if (base === undefined) return undefined;
    return Math.round((base - usageInViewYear[balanceKey]) * 100) / 100;
  };

  const activeLeaveMeta = LEAVE_MENU_TYPES.find((item) => item.type === activeType) ?? LEAVE_MENU_TYPES[0];
  const activeRecoveryMeta = RECOVERY_MENU_TYPES.find((item) => item.type === activeType) ?? RECOVERY_MENU_TYPES[0];
  const activeRemaining = requestKind === "leave" && !sickRequest ? remainingFor(activeLeaveMeta.balanceKey) : undefined;
  const supportsDuration = requestKind === "leave" && !sickRequest && (DURATION_LEAVE_TYPES as readonly string[]).includes(activeType);
  const supportsForm = requestKind !== "other" && requestKind !== "strike" && !sickRequest;

  // Alertes de solde en direct.
  const leaveExceeded = requestKind === "leave" && !sickRequest
    ? exceededLeaveBalance(selectedList, group, leaveRemainingByType, leaveRemainingByYear)
    : undefined;
  const cetExceeded = requestKind === "leave" && !sickRequest && selectedCetDays > 0 && cetRemaining !== undefined && selectedCetDays > Math.max(0, cetRemaining);
  const recoveryDurationMissing = requestKind === "recovery" && selectedList.some((item) =>
    item.type.startsWith("recovery_") && requestRecoveryMinutes([item], workQuota) <= 0,
  );
  const recoveryShortage = requestKind === "recovery" ? recoveryBalanceShortageMessage(recoveryBalanceRemaining, recoveryMinutes) : "";
  const warningMessage = leaveExceeded
    ? leaveBalanceShortageMessage(leaveExceeded.type, leaveExceeded.available, leaveExceeded.selected)
    : cetExceeded
      ? Math.max(0, cetRemaining ?? 0) === 0
        ? "Vous n’avez plus de jours CET disponibles."
        : `Il ne vous reste que ${Math.max(0, cetRemaining ?? 0)} jour${Math.max(0, cetRemaining ?? 0) > 1 ? "s" : ""} CET disponible${Math.max(0, cetRemaining ?? 0) > 1 ? "s" : ""}.`
      : recoveryDurationMissing
        ? "Renseignez les horaires de votre récupération."
        : recoveryShortage;

  // Indice de fractionnement 2027+.
  const offSeason2027 = selectedList.reduce((acc, item) => {
    const itemType = item.type === "half" ? halfBalanceOf(item) : item.type;
    if (itemType !== "annual") return acc;
    const y = Number(item.date.slice(0, 4));
    if (!usesFractionRule(y) || !isOffSeasonDate(item.date)) return acc;
    const info = getDayInfo(fromKey(item.date), group);
    if (info.holiday || info.kind === "off") return acc;
    return acc + (item.type === "half" ? 0.5 : 1);
  }, 0);

  // Résumé Début → Fin.
  const firstDate = selectedList[0]?.date;
  const lastDate = selectedList.length > 1 ? selectedList[selectedList.length - 1]?.date : undefined;

  // Résumé droit du bouton principal (« 29 → 22 CA », « 8 h 15 → 6 h 15 »…).
  const ctaSummaryRight = (() => {
    if (!selectedList.length) return "";
    if (requestKind === "recovery") {
      return recoveryMinutes > 0 && !recoveryShortage
        ? `${minutesLabel(recoveryBalanceRemaining)} → ${minutesLabel(recoveryBalanceRemaining - recoveryMinutes)}`
        : "";
    }
    if (requestKind === "leave" && !sickRequest) {
      const balanceKey = activeLeaveMeta.balanceKey;
      if (balanceKey === "cet" && cetRemaining !== undefined && selectedCetDays > 0) {
        return `${cetRemaining} → ${Math.max(0, cetRemaining - selectedCetDays)} CET`;
      }
      if (balanceKey && balanceKey !== "cet") {
        const before = yearBalances[balanceKey];
        const used = usageInViewYear[balanceKey];
        if (before !== undefined && used > 0) {
          return `${before.toLocaleString("fr-FR")} → ${Math.max(0, Math.round((before - used) * 100) / 100).toLocaleString("fr-FR")} ${activeLeaveMeta.short}`;
        }
      }
    }
    return "";
  })();

  const ctaLabel = (() => {
    if (savingRequest) return saveTarget === "form" && supportsForm ? "Ouverture du formulaire…" : "Enregistrement…";
    if (!selectedList.length) return "Touchez des dates";
    if (requestKind === "other") return `Enregistrer Divers · ${selectedList.length} j`;
    if (sickRequest) return `Enregistrer l’arrêt · ${selectedList.length} j`;
    if (requestKind === "recovery") {
      return recoveryMinutes > 0 ? `Enregistrer · ${minutesLabel(recoveryMinutes)}` : `Enregistrer · ${selectedList.length} date${s(selectedList.length)}`;
    }
    const daysText = totalDeductedDays > 0
      ? `${totalDeductedDays.toLocaleString("fr-FR")} jour${s(totalDeductedDays)}`
      : `${selectedList.length} date${s(selectedList.length)}`;
    return `Enregistrer · ${daysText}`;
  })();

  const title = requestKind === "leave"
    ? sickRequest ? "Arrêt maladie" : "Nouveau congé"
    : requestKind === "other"
      ? "Dates Divers"
      : requestKind === "strike"
        ? "Journée de grève"
        : "Récupération";

  const momentLabel = leaveMoment === "full" ? "Journée" : leaveMoment === "morning" ? "Matin" : "Après-midi";

  const handleSubmit = () => {
    if (supportsForm && saveTarget === "form") onValidateAndOpenForm();
    else onSaveToPlanning();
  };

  return createPortal(
    <div
      className="lrw-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !selectedList.length) onCancel();
      }}
    >
      <section
        id="request-panel"
        className={`lrw-card${sickRequest ? " sick-request-panel" : ""}${requestKind === "strike" ? " strike-request-panel" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ "--lrw-tone": activeColor } as CSSProperties}
        onClick={() => openMenu && setOpenMenu(null)}
      >
        {/* 1. En-tête minimaliste */}
        <header className="lrw-top">
          <h2>{title}</h2>
          <button type="button" className="lrw-close" onClick={onCancel} aria-label="Fermer">
            ×
          </button>
        </header>

        {/* 2. Menus rapides Type d'absence + Durée / Mode */}
        <div className="lrw-drop-bar" onClick={(event) => event.stopPropagation()}>
          <div className="lrw-drop-wrap">
            <button
              type="button"
              className={`lrw-drop-pill lrw-drop-type${openMenu === "type" ? " open" : ""}`}
              aria-expanded={openMenu === "type"}
              aria-label="Choisir le type d’absence"
              onClick={() => setOpenMenu((current) => (current === "type" ? null : "type"))}
            >
              <span className="lrw-drop-stack">
                <span className="lrw-drop-kicker">Type d’absence</span>
                <span className="lrw-drop-value">
                  <i className="lrw-dot" style={{ background: activeColor }} aria-hidden="true" />
                  <strong>
                    {requestKind === "leave" && !sickRequest
                      ? activeLeaveMeta.short
                      : requestKind === "recovery"
                        ? "Récupération"
                        : sickRequest
                          ? "Maladie"
                          : requestKind === "other"
                            ? "Divers"
                            : "Grève"}
                  </strong>
                  {requestKind === "leave" && !sickRequest && activeRemaining !== undefined ? (
                    <small className={activeRemaining < 0 ? "warn" : undefined}>
                      · {activeRemaining < 0 ? "dépassé" : `reste ${activeRemaining.toLocaleString("fr-FR")}\u00A0j`}
                    </small>
                  ) : requestKind === "recovery" ? (
                    <small>· {minutesLabel(recoveryBalanceRemaining)} dispo</small>
                  ) : null}
                </span>
              </span>
              <span className="lrw-chev" aria-hidden="true">▾</span>
            </button>
            {openMenu === "type" ? (
              <div className="lrw-menu" role="menu" aria-label="Types d’absence">
                {LEAVE_MENU_TYPES.map((item) => {
                  const rem = remainingFor(item.balanceKey);
                  const isCurrent = requestKind === "leave" && !sickRequest && activeType === item.type;
                  return (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={isCurrent}
                      key={item.type}
                      className={isCurrent ? "active" : undefined}
                      onClick={() => {
                        if (requestKind === "leave" && !sickRequest) onSelectLeaveType(item.type);
                        else onSwitchRequest?.("leave", item.type);
                        setOpenMenu(null);
                      }}
                    >
                      <i className="lrw-dot" style={{ background: TYPE_COLORS[item.type] }} aria-hidden="true" />
                      <span>{item.label}</span>
                      {rem !== undefined ? (
                        <small className={rem < 0 ? "warn" : undefined}>{`${rem.toLocaleString("fr-FR")}\u00A0j`}</small>
                      ) : null}
                    </button>
                  );
                })}
                <div className="lrw-menu-sep" role="separator" />
                {OTHER_ABSENCE_MENU_TYPES.map((item) => {
                  const isCurrent = item.sick
                    ? requestKind === "leave" && sickRequest
                    : requestKind === item.kind;
                  return (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={isCurrent}
                      key={item.type}
                      className={isCurrent ? "active" : undefined}
                      onClick={() => {
                        onSwitchRequest?.(item.kind, item.type);
                        setOpenMenu(null);
                      }}
                    >
                      <i className="lrw-dot" style={{ background: TYPE_COLORS[item.type] }} aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.kind === "recovery" ? <small>{minutesLabel(recoveryBalanceRemaining)}</small> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {supportsDuration ? (
            <div className="lrw-drop-wrap lrw-drop-duration">
              <button
                type="button"
                className={`lrw-drop-pill${openMenu === "duration" ? " open" : ""}`}
                aria-expanded={openMenu === "duration"}
                aria-label="Durée du congé"
                onClick={() => setOpenMenu((current) => (current === "duration" ? null : "duration"))}
              >
                <span className="lrw-drop-stack">
                  <span className="lrw-drop-kicker">Durée</span>
                  <strong className="lrw-drop-single">{momentLabel}</strong>
                </span>
                <span className="lrw-chev" aria-hidden="true">▾</span>
              </button>
              {openMenu === "duration" ? (
                <div className="lrw-menu lrw-menu-right" role="menu" aria-label="Durée">
                  {([["full", "Journée"], ["morning", "Matin"], ["afternoon", "Après-midi"]] as const).map(([value, label]) => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={leaveMoment === value}
                      key={value}
                      className={leaveMoment === value ? "active" : undefined}
                      onClick={() => {
                        onSelectLeaveMoment(value);
                        setOpenMenu(null);
                      }}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : requestKind === "recovery" ? (
            <div className="lrw-drop-wrap lrw-drop-duration">
              <button
                type="button"
                className={`lrw-drop-pill${openMenu === "duration" ? " open" : ""}`}
                aria-expanded={openMenu === "duration"}
                aria-label="Mode de récupération"
                onClick={() => setOpenMenu((current) => (current === "duration" ? null : "duration"))}
              >
                <span className="lrw-drop-stack">
                  <span className="lrw-drop-kicker">Mode</span>
                  <strong className="lrw-drop-single">{activeRecoveryMeta.short}</strong>
                </span>
                <span className="lrw-chev" aria-hidden="true">▾</span>
              </button>
              {openMenu === "duration" ? (
                <div className="lrw-menu lrw-menu-right" role="menu" aria-label="Modes de récupération">
                  {RECOVERY_MENU_TYPES.map((item) => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={activeType === item.type}
                      key={item.type}
                      className={activeType === item.type ? "active" : undefined}
                      onClick={() => {
                        onSelectRecoveryType(item.type);
                        setOpenMenu(null);
                      }}
                    >
                      <i className="lrw-dot" style={{ background: TYPE_COLORS[item.type] }} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Horaires demi-journée uniquement quand Matin ou Après-midi est choisi */}
        {supportsDuration && leaveMoment !== "full" ? (
          <div className="lrw-hours-row" role="group" aria-label={leaveMoment === "morning" ? "Heures posées le matin" : "Heures posées l’après-midi"}>
            <ClockTimePicker label="Début" value={leaveHours.start} onChange={(start) => onSelectLeaveHours({ ...leaveHours, start })} allowEmpty />
            <ClockTimePicker label="Fin" value={leaveHours.end} onChange={(end) => onSelectLeaveHours({ ...leaveHours, end })} allowEmpty />
            {leaveHours.start && leaveHours.end && leaveHours.end <= leaveHours.start ? (
              <small role="alert" className="lrw-hours-err">Fin après le début</small>
            ) : null}
          </div>
        ) : null}

        {/* 3. Cartouche Début → Fin */}
        {requestKind !== "strike" ? (
          <div className="lrw-from-to">
            <div className="lrw-ft-main">
              <span className="lrw-ft-box">
                <small>Début</small>
                <strong>{firstDate ? shortDayLabel(firstDate) : "Choisir"}</strong>
              </span>
              <span className="lrw-ft-arrow" aria-hidden="true">→</span>
              <span className="lrw-ft-box right">
                <small>Fin</small>
                <strong>{lastDate ? shortDayLabel(lastDate) : firstDate ? shortDayLabel(firstDate) : "—"}</strong>
              </span>
            </div>
          </div>
        ) : (
          <p className="lrw-strike-note">Touchez une journée travaillée pour l’ajouter immédiatement au planning.</p>
        )}

        {/* 4. Calendrier fluide en ruban continu */}
        <div
          className={`lrw-cal month-card${calendarSlide ? ` calendar-${calendarSlide}` : ""}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <MonthNavigation
            year={view.getFullYear()}
            month={view.getMonth()}
            onStep={onStepMonth}
            onSelect={onSelectMonth}
            onToday={onToday}
          />
          <div className="lrw-weekdays" aria-hidden="true">
            {WEEKDAYS.map(([id, day]) => <span key={id}>{day}</span>)}
          </div>
          <div className="lrw-days calendar-grid">
            {cells.map((slot, index) => {
              if (!slot.date) return <span className="lrw-empty" key={slot.key} aria-hidden="true" />;
              const cell = slot.date;
              const key = slot.key;
              const info = getDayInfo(cell, group);
              const sel = selectedByDate.get(key);
              const isToday = key === todayKey;
              const existingLeave = Boolean(hasExistingAbsence?.(key));
              const colIndex = index % 7;
              const prevSel = colIndex > 0 ? selectedByDate.get(prevDateKey(cell)) : undefined;
              const nextSel = colIndex < 6 ? selectedByDate.get(nextDateKey(cell)) : undefined;
              const linkPrev = Boolean(sel && sameRibbonGroup(sel, prevSel));
              const linkNext = Boolean(sel && sameRibbonGroup(sel, nextSel));
              const ribbonClass = sel
                ? linkPrev && linkNext
                  ? "sel mid"
                  : linkNext
                    ? "sel start"
                    : linkPrev
                      ? "sel end"
                      : "sel solo"
                : "";
              const halfMoment = sel?.type === "half"
                ? sel.halfMoment ?? (sel.start ? halfMomentFromStart(sel.start) : "morning")
                : undefined;
              return (
                <button
                  type="button"
                  key={key}
                  className={`day lrw-day ${info.kind}${info.holiday ? " holiday" : ""}${ribbonClass ? ` ${ribbonClass}` : ""}${isToday ? " today" : ""}${existingLeave && !sel ? " has-leave" : ""}${halfMoment ? ` is-half half-${halfMoment}` : ""}`}
                  style={sel ? ({ "--day-tone": selectionColor(sel) } as CSSProperties) : undefined}
                  onClick={() => onSelectDay(cell)}
                  aria-pressed={Boolean(sel)}
                  aria-label={`${longDate(cell)}${sel ? `, ${sel.type === "half" ? periodTypeLabel({ leaveType: "half", halfBalance: sel.halfBalance }) : TYPE_LABELS[sel.type]} sélectionné` : ""}`}
                >
                  <span>{cell.getDate()}</span>
                  {halfMoment ? <i className="lrw-half-dot" aria-hidden="true">½</i> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Tiroir optionnel de détail des dates (retrait × / Tout effacer) */}
        {requestKind !== "strike" && selectedList.length > 0 ? (
          <div className="lrw-detail-strip">
            <button
              type="button"
              className="lrw-detail-toggle"
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen((current) => !current)}
            >
              <span>{selectedList.length} date{s(selectedList.length)} choisie{s(selectedList.length)}</span>
              <span>{detailOpen ? "Masquer ▴" : "Détail ▾"}</span>
            </button>
            {selectedList.length >= 2 ? (
              <button type="button" className="lrw-clear-btn" onClick={onClearDates}>
                Tout effacer
              </button>
            ) : null}
          </div>
        ) : null}

        {detailOpen && selectedList.length > 0 ? (
          <div className="lrw-chips" role="region" aria-label="Résumé avant validation">
            {selectedList.map((item) => (
              <span className="lrw-chip" key={item.date} style={{ "--chip-tone": selectionColor(item) } as CSSProperties}>
                <i aria-hidden="true" />
                <span>{tinyChipDate(item.date)}</span>
                <small>{chipTypeLabel(item, workQuota)}</small>
                <button
                  type="button"
                  onClick={() => onRemoveDate(item.date)}
                  aria-label={`Retirer le ${shortDayLabel(item.date)}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {/* Alertes / Fractionnement 2027 */}
        {warningMessage ? (
          <p className="lrw-alert" role="alert">{warningMessage}</p>
        ) : offSeason2027 > 0 ? (
          <p className="lrw-fraction-note">
            Fractionnement : {offSeason2027.toLocaleString("fr-FR")} j de CA hors mai–octobre (4 j → +1 j, 7 j → +2 j).
          </p>
        ) : null}

        {/* 6. Pied épuré : switch Formulaire / Planning seul + 1 grand bouton CTA */}
        {requestKind !== "strike" ? (
          <footer className="lrw-foot">
            {supportsForm ? (
              <div className="lrw-mode-switch" role="radiogroup" aria-label="Mode d’enregistrement">
                <button
                  type="button"
                  role="radio"
                  data-mode="form"
                  aria-checked={saveTarget === "form"}
                  className={saveTarget === "form" ? "on" : undefined}
                  onClick={() => setSaveTarget("form")}
                >
                  Avec formulaire PDF
                </button>
                <button
                  type="button"
                  role="radio"
                  data-mode="planning"
                  aria-checked={saveTarget === "planning"}
                  className={saveTarget === "planning" ? "on" : undefined}
                  onClick={() => setSaveTarget("planning")}
                >
                  Planning seul
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className={`lrw-cta${supportsForm && saveTarget === "planning" ? " is-planning" : ""}`}
              disabled={!selectedList.length || savingRequest || selectionBlocked}
              onClick={handleSubmit}
            >
              <span>{ctaLabel}</span>
              {ctaSummaryRight ? <small>{ctaSummaryRight}</small> : null}
            </button>
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
