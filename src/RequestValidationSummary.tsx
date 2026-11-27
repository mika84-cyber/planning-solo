import type { BalanceType, RequestKind, SelectedDay } from "./appModel";
import { isOffSeasonDate, usesFractionRule } from "./fractionRules";
import { minutesLabel, recoveryRequestMinutes, type RecoveryRequestType, type WorkQuota } from "./overtime";
import { TYPE_LABELS, fromKey, getDayInfo, halfBalanceOf, longDate, periodTypeLabel, s } from "./planningLogic";

const QUOTA_BALANCE_TYPES = ["annual", "rtt", "fraction"] as const;

export function requestLeaveBalanceUsage(items: SelectedDay[], group: number) {
  return Object.fromEntries(QUOTA_BALANCE_TYPES.map((type) => [
    type,
    items.reduce((total, item) => {
      const itemType = item.type === "half" ? halfBalanceOf(item) : item.type;
      if (itemType !== type) return total;
      const info = getDayInfo(fromKey(item.date), group);
      if (info.holiday || info.kind === "off") return total;
      return total + (item.type === "half" ? 0.5 : 1);
    }, 0),
  ])) as Record<BalanceType, number>;
}

export type LeaveRemaining = Partial<Record<BalanceType, number>>;
/** Soldes restants par année (« 2027 ») : le solde repart au 1er janvier,
 *  donc une date de 2027 posée dès 2026 compte sur le solde de 2027. */
export type LeaveRemainingByYear = Record<string, LeaveRemaining>;

/** Dates regroupées par année, dans l'ordre. */
function itemsByYear(items: SelectedDay[]) {
  const groups = new Map<string, SelectedDay[]>();
  [...items].sort((a, b) => a.date.localeCompare(b.date)).forEach((item) => {
    const year = item.date.slice(0, 4);
    groups.set(year, [...(groups.get(year) || []), item]);
  });
  return [...groups.entries()];
}

/** Le premier solde que la sélection dépasse, année par année. Un solde nul
 *  comme un reste trop court bloquent la validation : on ne pose pas plus de
 *  jours qu'il n'en reste. */
export function exceededLeaveBalance(
  items: SelectedDay[],
  group: number,
  remaining: LeaveRemaining,
  remainingByYear?: LeaveRemainingByYear,
) {
  for (const [year, yearItems] of itemsByYear(items)) {
    const usage = requestLeaveBalanceUsage(yearItems, group);
    const yearRemaining = remainingByYear?.[year] ?? remaining;
    const type = QUOTA_BALANCE_TYPES.find((balanceType) =>
      usage[balanceType] > Math.max(0, yearRemaining[balanceType] ?? Number.POSITIVE_INFINITY),
    );
    if (type)
      return { type, available: Math.max(0, yearRemaining[type] ?? 0), selected: usage[type] };
  }
  return undefined;
}

function leaveBalanceLabel(type: BalanceType) {
  if (type === "annual") return "CA";
  if (type === "rtt") return "RTT";
  return "Fractionnement";
}

function dayAmount(value: number) {
  return `${value.toLocaleString("fr-FR")} jour${s(value)}`;
}

function leaveBalanceRemainingLabel(type: BalanceType, remaining: number) {
  const amount = Math.max(0, remaining);
  const value = amount.toLocaleString("fr-FR");
  const plural = amount > 1 ? "s" : "";
  if (type === "annual") return `${value} CA restant${plural}`;
  if (type === "rtt") return `${value} RTT restant${plural}`;
  return `${value} jour${plural} de fractionnement restant${plural}`;
}

function selectedDayAmount(value: number) {
  if (value === 0.5) return "une demi-journée";
  if (value === 1) return "un";
  return value.toLocaleString("fr-FR");
}

export function leaveBalanceShortageMessage(
  type: BalanceType,
  available: number,
  selected: number,
) {
  const remaining = Math.max(0, available);
  if (selected <= remaining) return "";
  if (remaining === 0) {
    if (type === "annual") return "Vous n’avez plus de congés annuels disponibles.";
    if (type === "rtt") return "Vous n’avez plus de RTT disponibles.";
    return "Vous n’avez plus de jours de fractionnement disponibles.";
  }
  const category = type === "annual"
    ? remaining > 1 ? "de congés annuels" : "de congé annuel"
    : type === "rtt"
      ? "de RTT"
      : "de fractionnement";
  const remainingText = remaining === 0.5
    ? `qu’une demi-journée ${category} disponible`
    : remaining === 1
      ? `qu’un jour ${category} disponible`
      : `que ${dayAmount(remaining)} ${category} disponible${remaining > 1 ? "s" : ""}`;
  return `Il ne vous reste ${remainingText}. Vous en avez sélectionné ${selectedDayAmount(selected)}.`;
}

export function recoveryBalanceShortageMessage(available: number, selected: number) {
  const remaining = Math.max(0, available);
  if (selected <= remaining) return "";
  if (remaining === 0) return "Vous n’avez plus d’heures de récupération disponibles.";
  return `Il ne vous reste que ${minutesLabel(remaining)} de récupération disponibles. Vous avez sélectionné ${minutesLabel(selected)}.`;
}

export function requestRecoveryMinutes(items: SelectedDay[], workQuota: WorkQuota) {
  return items.reduce((total, item) => total + recoveryRequestMinutes(
    item.type as RecoveryRequestType,
    workQuota,
    item.start,
    item.end,
  ), 0);
}

function impactLabel(kind: RequestKind, sickRequest: boolean) {
  if (kind === "other") return "Repère visible uniquement dans le planning, sans effet sur la paie ni les soldes.";
  if (kind === "strike") return "Jour non travaillé, sans effet sur les soldes, avec retenue brute estimée au trentième.";
  if (sickRequest) return "Ajouté au suivi des arrêts maladie. Seuls les congés annuels déjà posés sur ces dates seront retirés et recrédités automatiquement ; les autres congés resteront annulables manuellement.";
  if (kind === "recovery") return "Déduit du solde d’heures de récupération selon la durée choisie.";
  return "Déduit du solde correspondant après enregistrement de la demande.";
}

export function RequestValidationSummary({
  items,
  requestKind,
  sickRequest,
  group = 2,
  workQuota = "full",
  recoveryBalanceRemaining = 0,
  leaveRemaining = {},
  leaveRemainingByYear,
  cetRemaining,
  currentYear,
  onRemoveDate,
  onClearDates,
}: {
  items: SelectedDay[];
  requestKind: RequestKind;
  sickRequest: boolean;
  group?: number;
  workQuota?: WorkQuota;
  recoveryBalanceRemaining?: number;
  leaveRemaining?: LeaveRemaining;
  /** Prioritaire sur `leaveRemaining` pour les années qu'il contient. */
  leaveRemainingByYear?: LeaveRemainingByYear;
  /** Jours CET disponibles ; vérifié en direct quand la demande pose du CET. */
  cetRemaining?: number;
  /** Année en cours : une autre année est nommée devant son solde. */
  currentYear?: number;
  /** Retire une date précise directement depuis le récapitulatif. */
  onRemoveDate?: (date: string) => void;
  /** Vide toute la sélection d'un seul geste. */
  onClearDates?: () => void;
}) {
  if (!items.length) return null;
  const recoveryMinutes = requestKind === "recovery"
    ? requestRecoveryMinutes(items, workQuota)
    : 0;
  const recoveryDurationMissing = requestKind === "recovery" && items.some((item) =>
    item.type.startsWith("recovery_") && requestRecoveryMinutes([item], workQuota) <= 0
  );
  const leaveItems = items.filter((item) => item.type === "annual" || item.type === "half" || item.type === "rtt" || item.type === "fraction");
  const cetDays = items.filter((item) => {
    if (item.type !== "cet") return false;
    const info = getDayInfo(fromKey(item.date), group);
    return !info.holiday && info.kind !== "off";
  }).length;
  const cetShortage = cetDays > 0 && cetRemaining !== undefined && cetDays > Math.max(0, cetRemaining)
    ? Math.max(0, cetRemaining) === 0
      ? "Vous n’avez plus de jours CET disponibles."
      : `Il ne vous reste que ${dayAmount(Math.max(0, cetRemaining))} CET disponible${Math.max(0, cetRemaining) > 1 ? "s" : ""}. Vous en avez sélectionné ${cetDays}.`
    : "";
  const offSeasonAnnualByYear = yearGroupsOffSeason(items, group);
  const requestedBalanceTypes = new Set(
    leaveItems.map((item) => item.type === "half" ? halfBalanceOf(item) : item.type),
  );
  // Chaque année a son propre solde : les dates sont décomptées année par
  // année, et l'année est nommée dès qu'elle n'est pas l'année en cours.
  const yearGroups = itemsByYear(items);
  const nameYears = yearGroups.length > 1 ||
    (currentYear !== undefined && yearGroups.some(([year]) => year !== String(currentYear)));
  const leaveUsage = yearGroups.flatMap(([year, yearItems]) => {
    const balanceUsage = requestLeaveBalanceUsage(yearItems, group);
    return QUOTA_BALANCE_TYPES.map((type) => ({
      year,
      type,
      units: balanceUsage[type],
    })).filter(({ type, units }) => requestedBalanceTypes.has(type) && (units > 0 || yearGroups.length === 1));
  });
  const deductedDays = leaveUsage.reduce((total, usage) => total + usage.units, 0) + cetDays;
  const skippedDays = leaveItems.filter((item) => {
    const info = getDayInfo(fromKey(item.date), group);
    return info.holiday || info.kind === "off";
  }).length;
  const recoveryShortage = recoveryBalanceShortageMessage(recoveryBalanceRemaining, recoveryMinutes);
  return (
    <section className="request-validation-summary" aria-label="Résumé avant validation">
      <header>
        <span>Résumé avant validation</span>
        <div className="request-validation-header-actions">
          {onClearDates && items.length >= 2 ? (
            <button type="button" className="request-clear-dates" onClick={onClearDates}>Tout effacer</button>
          ) : null}
          <strong>
            {items.length} date{s(items.length)}
          </strong>
        </div>
      </header>
      <div className="request-validation-dates">
        {items.map((item) => (
          <article key={item.date}>
            <span>
              <strong>{longDate(fromKey(item.date))}</strong>
              <small>{item.type === "half" ? periodTypeLabel({ leaveType: "half", halfBalance: item.halfBalance }) : TYPE_LABELS[item.type]}</small>
            </span>
            <div className="request-validation-date-end">
              {item.type.startsWith("recovery_") ? (
                <em>{minutesLabel(recoveryRequestMinutes(item.type as RecoveryRequestType, workQuota, item.start, item.end))}</em>
              ) : item.halfMoment ? (
                <em>{item.halfMoment === "morning" ? "Matin" : "Après-midi"}</em>
              ) : item.start || item.end ? (
                <em>
                  {item.start || "—"} → {item.end || "—"}
                </em>
              ) : null}
              {onRemoveDate ? (
                <button
                  type="button"
                  className="request-remove-date"
                  onClick={() => onRemoveDate(item.date)}
                  aria-label={`Retirer le ${longDate(fromKey(item.date))}`}
                  title="Retirer cette date"
                >
                  ×
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {requestKind === "recovery" ? (
        <div className="request-validation-impact" aria-live="polite">
          <strong>{recoveryDurationMissing ? "Durée à renseigner" : `${minutesLabel(recoveryMinutes)} déduites`}</strong>
          {recoveryDurationMissing ? (
            <span className="request-validation-warning">Choisissez le nombre d’heures et de minutes avant d’enregistrer.</span>
          ) : recoveryShortage ? (
            <span className="request-validation-warning">{recoveryShortage}</span>
          ) : (
            <span>Solde disponible : {minutesLabel(recoveryBalanceRemaining)} → {minutesLabel(recoveryBalanceRemaining - recoveryMinutes)}</span>
          )}
        </div>
      ) : leaveItems.length || cetDays > 0 ? (
        <div className="request-validation-impact" aria-live="polite">
          <strong>{items.length} date{s(items.length)} sélectionnée{s(items.length)} · {deductedDays.toLocaleString("fr-FR")} jour{s(deductedDays)} déduit{s(deductedDays)}</strong>
          {leaveUsage.map(({ year, type, units }) => {
            const remaining = (leaveRemainingByYear?.[year] ?? leaveRemaining)[type];
            const shortage = remaining === undefined ? "" : leaveBalanceShortageMessage(type, remaining, units);
            return (
              <span key={`${year}-${type}`} className={shortage ? "request-validation-warning" : undefined}>
                {nameYears ? `${year} · ` : ""}
                {remaining === undefined
                  ? `${leaveBalanceLabel(type)} : ${dayAmount(units)} déduit${s(units)}`
                  : shortage
                    ? shortage
                    : `${leaveBalanceRemainingLabel(type, remaining - units)}${units > 0 ? ` (sur ${Math.max(0, remaining).toLocaleString("fr-FR")})` : ""}`}
              </span>
            );
          })}
          {cetDays > 0 ? (
            <span className={cetShortage ? "request-validation-warning" : undefined}>
              {cetRemaining === undefined
                ? `CET : ${dayAmount(cetDays)} déduit${s(cetDays)}`
                : cetShortage
                  ? cetShortage
                  : `${Math.max(0, cetRemaining - cetDays).toLocaleString("fr-FR")} jour${Math.max(0, cetRemaining - cetDays) > 1 ? "s" : ""} CET restant${Math.max(0, cetRemaining - cetDays) > 1 ? "s" : ""} (sur ${Math.max(0, cetRemaining).toLocaleString("fr-FR")})`}
            </span>
          ) : null}
          {offSeasonAnnualByYear.map(([year, days]) => (
            <span key={`fraction-${year}`} className="request-validation-fraction-hint">
              Fractionnement {year} : {dayAmount(days)} de CA hors mai–octobre (4 j → +1 j, 7 j → +2 j).
            </span>
          ))}
          {skippedDays ? <span>{skippedDays} jour{s(skippedDays)} de repos ou férié non décompté{s(skippedDays)}.</span> : null}
        </div>
      ) : null}
      <p>
        <strong>Effet de la validation</strong>
        <span>{impactLabel(requestKind, sickRequest)}</span>
      </p>
    </section>
  );
}

/** CA (entiers ou demi-journées) posés hors mai–octobre sur une année qui
 *  applique le barème de fractionnement (à partir de 2027). */
function yearGroupsOffSeason(items: SelectedDay[], group: number) {
  const byYear = new Map<number, number>();
  for (const item of items) {
    const itemType = item.type === "half" ? halfBalanceOf(item) : item.type;
    if (itemType !== "annual") continue;
    const year = Number(item.date.slice(0, 4));
    if (!usesFractionRule(year) || !isOffSeasonDate(item.date)) continue;
    const info = getDayInfo(fromKey(item.date), group);
    if (info.holiday || info.kind === "off") continue;
    byYear.set(year, (byYear.get(year) ?? 0) + (item.type === "half" ? 0.5 : 1));
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]);
}
