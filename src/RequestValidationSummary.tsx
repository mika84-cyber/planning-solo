import type { BalanceType, RequestKind, SelectedDay } from "./appModel";
import { minutesLabel, recoveryRequestMinutes, type RecoveryRequestType, type WorkQuota } from "./overtime";
import { TYPE_LABELS, fromKey, getDayInfo, longDate, s } from "./planningLogic";

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
    ? items.reduce((total, item) => total + recoveryRequestMinutes(
        item.type as RecoveryRequestType,
        workQuota,
        item.start,
        item.end,
      ), 0)
    : 0;
  const leaveItems = items.filter((item) => item.type === "annual" || item.type === "half" || item.type === "rtt" || item.type === "fraction");
  const deductedDays = leaveItems.reduce((total, item) => {
    const info = getDayInfo(fromKey(item.date), group);
    if (info.holiday || info.kind === "off") return total;
    return total + (item.type === "half" ? 0.5 : 1);
  }, 0);
  const skippedDays = leaveItems.filter((item) => {
    const info = getDayInfo(fromKey(item.date), group);
    return info.holiday || info.kind === "off";
  }).length;
  const balanceTypes = new Set(leaveItems.map((item) => item.type === "half" ? "annual" : item.type));
  const balanceType = balanceTypes.size === 1 ? [...balanceTypes][0] as BalanceType : null;
  const remaining = balanceType ? leaveRemaining[balanceType] : undefined;
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
        <div className="request-validation-impact">
          <strong>{items.length === 1 && items[0].start && items[0].end ? `${items[0].start}–${items[0].end} · ` : ""}{minutesLabel(recoveryMinutes)} déduites</strong>
          <span>Solde disponible : {minutesLabel(recoveryBalanceRemaining)} → {minutesLabel(Math.max(0, recoveryBalanceRemaining - recoveryMinutes))}</span>
        </div>
      ) : leaveItems.length ? (
        <div className="request-validation-impact">
          <strong>{items.length} date{s(items.length)} sélectionnée{s(items.length)} · {deductedDays.toLocaleString("fr-FR")} jour{s(deductedDays)} déduit{s(deductedDays)}</strong>
          {remaining !== undefined ? <span>Solde {balanceType === "annual" ? "CA" : balanceType === "rtt" ? "RTT" : "fractionnement"} : {remaining.toLocaleString("fr-FR")} → {Math.max(0, remaining - deductedDays).toLocaleString("fr-FR")} jour{s(Math.max(0, remaining - deductedDays))}</span> : null}
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
