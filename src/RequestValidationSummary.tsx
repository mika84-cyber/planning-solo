import type { BalanceType, RequestKind, SelectedDay } from "./appModel";
import { minutesLabel, recoveryRequestMinutes, type RecoveryRequestType, type WorkQuota } from "./overtime";
import { TYPE_LABELS, fromKey, getDayInfo, longDate, s } from "./planningLogic";

const QUOTA_BALANCE_TYPES = ["annual", "rtt", "fraction"] as const;

function leaveBalanceLabel(type: BalanceType) {
  if (type === "annual") return "CA";
  if (type === "rtt") return "RTT";
  return "Fractionnement";
}

function dayAmount(value: number) {
  return `${value.toLocaleString("fr-FR")} jour${s(value)}`;
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
}: {
  items: SelectedDay[];
  requestKind: RequestKind;
  sickRequest: boolean;
  group?: number;
  workQuota?: WorkQuota;
  recoveryBalanceRemaining?: number;
  leaveRemaining?: Partial<Record<BalanceType, number>>;
}) {
  if (!items.length) return null;
  const recoveryMinutes = requestKind === "recovery"
    ? requestRecoveryMinutes(items, workQuota)
    : 0;
  const leaveItems = items.filter((item) => item.type === "annual" || item.type === "half" || item.type === "rtt" || item.type === "fraction");
  const requestedBalanceTypes = new Set(
    leaveItems.map((item) => item.type === "half" ? "annual" : item.type),
  );
  const leaveUsage = QUOTA_BALANCE_TYPES.map((type) => ({
    type,
    units: leaveItems.reduce((total, item) => {
      const itemType = item.type === "half" ? "annual" : item.type;
      if (itemType !== type) return total;
      const info = getDayInfo(fromKey(item.date), group);
      if (info.holiday || info.kind === "off") return total;
      return total + (item.type === "half" ? 0.5 : 1);
    }, 0),
  })).filter(({ type }) => requestedBalanceTypes.has(type));
  const deductedDays = leaveUsage.reduce((total, usage) => total + usage.units, 0);
  const skippedDays = leaveItems.filter((item) => {
    const info = getDayInfo(fromKey(item.date), group);
    return info.holiday || info.kind === "off";
  }).length;
  const recoveryShortage = recoveryBalanceShortageMessage(recoveryBalanceRemaining, recoveryMinutes);
  return (
    <section className="request-validation-summary" aria-label="Résumé avant validation">
      <header>
        <span>Résumé avant validation</span>
        <strong>
          {items.length} date{s(items.length)}
        </strong>
      </header>
      <div className="request-validation-dates">
        {items.map((item) => (
          <article key={item.date}>
            <span>
              <strong>{longDate(fromKey(item.date))}</strong>
              <small>{TYPE_LABELS[item.type]}</small>
            </span>
            {item.start || item.end ? (
              <em>
                {item.start || "—"} → {item.end || "—"}
              </em>
            ) : null}
          </article>
        ))}
      </div>
      {requestKind === "recovery" ? (
        <div className="request-validation-impact" aria-live="polite">
          <strong>{items.length === 1 && items[0].start && items[0].end ? `${items[0].start}–${items[0].end} · ` : ""}{minutesLabel(recoveryMinutes)} déduites</strong>
          {recoveryShortage ? (
            <span className="request-validation-warning">{recoveryShortage}</span>
          ) : (
            <span>Solde disponible : {minutesLabel(recoveryBalanceRemaining)} → {minutesLabel(recoveryBalanceRemaining - recoveryMinutes)}</span>
          )}
        </div>
      ) : leaveItems.length ? (
        <div className="request-validation-impact" aria-live="polite">
          <strong>{items.length} date{s(items.length)} sélectionnée{s(items.length)} · {deductedDays.toLocaleString("fr-FR")} jour{s(deductedDays)} déduit{s(deductedDays)}</strong>
          {leaveUsage.map(({ type, units }) => {
            const remaining = leaveRemaining[type];
            const shortage = remaining === undefined ? "" : leaveBalanceShortageMessage(type, remaining, units);
            return (
              <span key={type} className={shortage ? "request-validation-warning" : undefined}>
                {leaveBalanceLabel(type)} : {dayAmount(units)} déduit{s(units)}
                {remaining === undefined
                  ? null
                  : shortage
                    ? ` · ${shortage}`
                    : ` · ${remaining.toLocaleString("fr-FR")} → ${(remaining - units).toLocaleString("fr-FR")}`}
              </span>
            );
          })}
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
