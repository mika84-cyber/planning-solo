import { ChoicePicker } from "./ChoicePicker";
import { LeaveInfoCard } from "./LeaveInfoCard";
import type { BalanceType, LeavePeriod } from "./appModel";
import {
  COUNTED_ONLY_TYPES,
  TYPE_LABELS,
  YEAR_OPTIONS,
  leaveTypeLabel,
  s,
  type CountedOnlyType,
  typeLabelFor,
} from "./planningLogic";

const STOCK_SHORT_LABELS: Record<BalanceType, string> = {
  annual: "CA",
  rtt: "RTT",
  fraction: "Fract.",
};

type BalanceDetail = {
  date: string;
  units: number;
  period: LeavePeriod;
};

type LeaveBalance = {
  type: BalanceType;
  allowance: number;
  manualUsed: number;
  used: number;
  taken: number;
  upcoming: number;
  remaining: number;
  details: BalanceDetail[];
};

type CountedOnlyBalances = Record<
  CountedOnlyType,
  { used: number; details: BalanceDetail[] }
>;

type LeaveBalancesSectionProps = {
  year: number;
  totalRemaining: number;
  balances: LeaveBalance[];
  countedOnly: CountedOnlyBalances;
  manualSundayLeaveTotal: number;
  onYearChange: (year: number) => void;
  onSelectBalance: (type: BalanceType | CountedOnlyType) => void;
  onOpenManualAdjustments: () => void;
};

export function LeaveBalancesSection({
  year,
  totalRemaining,
  balances,
  countedOnly,
  manualSundayLeaveTotal,
  onYearChange,
  onSelectBalance,
  onOpenManualAdjustments,
}: LeaveBalancesSectionProps) {
  const otherCountedTypes: readonly CountedOnlyType[] = [
    ...COUNTED_ONLY_TYPES.filter((type) => type !== "sick" && type !== "strike" && type !== "work_accident"),
    "strike",
    "work_accident",
  ];
  const countedBalanceButton = (type: CountedOnlyType) => {
    const used = countedOnly[type].used;
    return (
      <button
        type="button"
        key={type}
        className={`${type} leave-balance-tracked${used === 0 ? " is-zero" : ""}`}
        onClick={() => onSelectBalance(type)}
        aria-label={`Afficher le détail de ${TYPE_LABELS[type]}`}
      >
        <span className="leave-balance-copy">
          <span>{typeLabelFor(type, used)}</span>
          <small>
            {type === "cet"
              ? "déduit du solde CET"
              : type === "strike"
                ? "retenue estimée dans Ma paie"
                : type === "other"
                  ? "compté dans les jours non travaillés"
                  : type === "work_accident"
                    ? "sans carence · CA superposés recrédités"
                    : "sans effet sur les congés"}
          </small>
        </span>
        <strong>
          {used.toLocaleString("fr-FR")}
          <i>pris</i>
        </strong>
      </button>
    );
  };
  return (
    <section className="leave-balances-direct" aria-labelledby="leave-balances-title">
      <div className="leave-balances-heading">
        <div>
          <span className="step-label">Soldes disponibles</span>
          <h3 id="leave-balances-title">Mes soldes de congés</h3>
        </div>
        <div className="leave-year-tools">
          <label>
            <span>Année</span>
            <ChoicePicker
              value={year}
              options={YEAR_OPTIONS}
              onChange={onYearChange}
              ariaLabel="Choisir l’année des absences"
              className="leave-year-picker"
            />
          </label>
          <strong>{totalRemaining.toLocaleString("fr-FR")} jours restants</strong>
        </div>
      </div>
      <div className="request-archive-content direct-balances-content">
        <LeaveInfoCard />
        <div className="leave-balance-grid">
          <div className="leave-balance-subhead" aria-hidden="true">
            <span>Soldes à poser</span>
          </div>
          {balances.map((balance) => (
            <button
              type="button"
              key={balance.type}
              className={`${balance.type} leave-balance-stock`}
              onClick={() => onSelectBalance(balance.type)}
              aria-label={`Afficher le détail de ${leaveTypeLabel(balance.type)}`}
            >
              <span className="leave-balance-stock-label">
                <span className="leave-balance-name-full">{typeLabelFor(balance.type, balance.remaining)}</span>
                <span className="leave-balance-name-short" aria-hidden="true">{STOCK_SHORT_LABELS[balance.type]}</span>
              </span>
              <strong>
                {balance.remaining.toLocaleString("fr-FR")}
                <i>j</i>
              </strong>
              <small className="leave-balance-detail">
                <span>{balance.taken.toLocaleString("fr-FR")} déjà pris</span>
                <i> · </i>
                <span>{balance.upcoming.toLocaleString("fr-FR")} à venir</span>
              </small>
              {balance.manualUsed > 0 ? (
                <small className="manual-balance-note">
                  dont {balance.manualUsed.toLocaleString("fr-FR")} saisi
                  {s(balance.manualUsed)} sans date
                </small>
              ) : null}
            </button>
          ))}
          <div className="leave-balance-subhead leave-balance-subhead-tracked" aria-hidden="true">
            <span>Autres absences</span>
          </div>
          {countedBalanceButton("sick")}
          {/* Les sept suivis d'absences en mini-tuiles compactes à la suite. */}
          {otherCountedTypes.map(countedBalanceButton)}
        </div>
        <button
          className="manual-adjustments-trigger"
          type="button"
          onClick={onOpenManualAdjustments}
        >
          <span className="manual-adjustments-icon" aria-hidden="true">
            ↺
          </span>
          <span className="manual-adjustments-copy">
            <strong>Reprendre mes absences précédentes</strong>
            <small>Ajouter un historique sans renseigner chaque date</small>
          </span>
          <span className="manual-adjustments-summary">
            {manualSundayLeaveTotal
              ? `${manualSundayLeaveTotal} dimanche${s(manualSundayLeaveTotal)}`
              : "Configurer"}
            <i aria-hidden="true">›</i>
          </span>
        </button>
      </div>
    </section>
  );
}
