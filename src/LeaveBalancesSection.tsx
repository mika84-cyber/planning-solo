import { ChoicePicker } from "./ChoicePicker";
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
  const otherCountedTypes = [
    ...COUNTED_ONLY_TYPES.filter((type) => type !== "sick" && type !== "strike"),
    "strike" as const,
  ];
  const countedBalanceButton = (type: CountedOnlyType) => (
    <button
      type="button"
      key={type}
      className={type}
      onClick={() => onSelectBalance(type)}
      aria-label={`Afficher le détail de ${TYPE_LABELS[type]}`}
    >
      <span>{typeLabelFor(type, countedOnly[type].used)}</span>
      <strong>
        {countedOnly[type].used.toLocaleString("fr-FR")}
        <i>pris</i>
      </strong>
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
      <em>Voir le détail</em>
    </button>
  );
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
        <div className="leave-balance-grid">
          {balances.map((balance) => (
            <button
              type="button"
              key={balance.type}
              className={balance.type}
              onClick={() => onSelectBalance(balance.type)}
              aria-label={`Afficher le détail de ${leaveTypeLabel(balance.type)}`}
            >
              <span>{typeLabelFor(balance.type, balance.remaining)}</span>
              <strong>
                {balance.remaining.toLocaleString("fr-FR")}
                <i>restant{s(balance.remaining)}</i>
              </strong>
              <small>
                {balance.taken.toLocaleString("fr-FR")} déjà pris · {balance.upcoming.toLocaleString("fr-FR")} à venir
              </small>
              {balance.manualUsed > 0 ? (
                <small className="manual-balance-note">
                  dont {balance.manualUsed.toLocaleString("fr-FR")} saisi
                  {s(balance.manualUsed)} sans date
                </small>
              ) : null}
              <em>Voir le détail</em>
            </button>
          ))}
          {countedBalanceButton("sick")}
        </div>
        <details className="other-leave-balances">
          <summary>
            <span className="leave-secondary-menu-icon" aria-hidden="true">•••</span>
            <span className="leave-secondary-menu-copy">
              <strong>Autres congés</strong>
              <small>CET, garde d’enfant et absences particulières</small>
            </span>
            <b>{otherCountedTypes.length} catégories</b>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="leave-balance-grid">
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
        </details>
      </div>
    </section>
  );
}
