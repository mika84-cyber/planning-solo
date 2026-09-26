import { ChoicePicker } from "./ChoicePicker";
import { FRACTION_CATEGORY_OPTIONS, FRACTION_RULES, type FractionCategory } from "./fractionRules";
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

function daysLabel(value: number) {
  return `${value.toLocaleString("fr-FR")} jour${value > 1 ? "s" : ""}`;
}

function grantLabel(grant: number) {
  return grant === 0.5 ? "½ jour de fractionnement" : `${grant} jour${grant > 1 ? "s" : ""} de fractionnement`;
}

type LeaveBalancesSectionProps = {
  year: number;
  totalRemaining: number;
  balances: LeaveBalance[];
  countedOnly: CountedOnlyBalances;
  manualSundayLeaveTotal: number;
  /** Dès 2027 : CA posés hors mai–octobre et palier suivant du fractionnement. */
  fractionRule?: { offSeasonDays: number; next: { missing: number; grant: number } | null } | null;
  fractionCategory?: FractionCategory;
  onFractionCategoryChange?: (category: FractionCategory) => void;
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
  fractionRule = null,
  fractionCategory = "visitor_service",
  onFractionCategoryChange,
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
        {fractionRule ? (
          <div className="fraction-rule">
            <p>
              <strong>Fractionnement {year}</strong>
              <span>
                {daysLabel(fractionRule.offSeasonDays)} de congés annuels posé{s(fractionRule.offSeasonDays)} hors mai–octobre
                {fractionRule.next
                  ? ` · encore ${daysLabel(fractionRule.next.missing)} pour ${grantLabel(fractionRule.next.grant)}`
                  : " · droit complet atteint"}
              </span>
              <small>
                {FRACTION_RULES[fractionCategory].steps
                  .map((step) => `${step.from.toLocaleString("fr-FR")} j → ${grantLabel(step.grant)}`)
                  .join(" · ")}
                {" "}(RTT non comptés)
              </small>
            </p>
            {onFractionCategoryChange ? (
              <label>
                <span>Votre catégorie</span>
                <ChoicePicker
                  value={fractionCategory}
                  options={FRACTION_CATEGORY_OPTIONS}
                  onChange={onFractionCategoryChange}
                  ariaLabel="Choisir votre catégorie pour le fractionnement"
                  className="fraction-category-picker"
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <details className="other-leave-balances">
          <summary>
            <span className="leave-secondary-menu-icon" aria-hidden="true">•••</span>
            <span className="leave-secondary-menu-copy">
              <strong>Autres congés</strong>
              <small>CET, garde d’enfant et absences particulières</small>
            </span>
            <b>{otherCountedTypes.length} catégories</b>
            <i aria-hidden="true">⌄</i>
            {/* Une fois ouvert, le même bouton se contente de dire qu'il referme. */}
            <span className="other-leave-close">
              Refermer le volet
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
            </span>
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
