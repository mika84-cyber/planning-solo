import { ChoicePicker } from "./ChoicePicker";
import { HOLIDAY_PAY_OPTIONS, euros } from "./appModel";
import { minutesLabel } from "./overtime";
import {
  MONTHS,
  SUNDAY_ALLOWANCE,
  SUNDAY_TIERS,
  holidayAllowance,
  holidayPayslip,
  s,
  shortDate,
  sundayAllowance,
  type HolidayPay,
} from "./planningLogic";

type HolidayAllowanceItem = {
  key: string;
  name: string;
  choice: HolidayPay | "";
};

type CancelledHolidayItem = {
  key: string;
  name: string;
};

export type PayAllowancesModel = {
  year: number;
  sundayTotal: ReturnType<typeof sundayAllowance>;
  sundayDone: number;
  sundayLeft: number;
  sundayCount: number;
  sundaysScheduledPast: number;
  tier: { label: string };
  holidays: HolidayAllowanceItem[];
  cancelledHolidays: CancelledHolidayItem[];
  compensated: HolidayAllowanceItem[];
  holidayPending: number;
  monthlyTotal: number;
};

export type AllowanceMonthPay = {
  sundayCount: number;
  sunday: number;
  holidayCount: number;
  holiday: number;
  strikeDeductedDays: number;
  strikeAutomaticDays: number;
  strikePotentialDays: number;
};

type OvertimeForPayMonth = {
  totalMinutes: number;
  ready: boolean;
  amount: number;
};

type MecenatForPayMonth = {
  totalMinutes: number;
  grossAmountCents: number;
};

type StrikeForPayMonth = {
  totalDeduction: number | null;
};

type PayAllowancesSectionProps = {
  allowances: PayAllowancesModel;
  monthPay: AllowanceMonthPay | null;
  overtimeForPayMonth: OvertimeForPayMonth;
  mecenatForPayMonth: MecenatForPayMonth;
  strikeForPayMonth: StrikeForPayMonth;
  isContractuel: boolean;
  baseSalary: number;
  month: number;
  year: number;
  payPeriodOpen: boolean;
  holidayChoiceEditing: string | null;
  onTogglePayPeriod: () => void;
  onChangeMonth: (delta: 1 | -1) => void;
  onGoToday: () => void;
  onEditHolidayChoice: (key: string | null) => void;
  onChooseHolidayPay: (key: string, choice: HolidayPay) => void | Promise<void>;
};

export function PayAllowancesSection({
  allowances,
  monthPay,
  overtimeForPayMonth,
  mecenatForPayMonth,
  strikeForPayMonth,
  isContractuel,
  baseSalary,
  month,
  year,
  payPeriodOpen,
  holidayChoiceEditing,
  onTogglePayPeriod,
  onChangeMonth,
  onGoToday,
  onEditHolidayChoice,
  onChooseHolidayPay,
}: PayAllowancesSectionProps) {
  const { sundayTotal } = allowances;
  const variableRows = [
    {
      label: "Dimanches",
      quantity: monthPay?.sundayCount
        ? `${monthPay.sundayCount} dimanche${s(monthPay.sundayCount)} versé${s(monthPay.sundayCount)} sur cette paie`
        : "Aucun dimanche versé sur cette paie",
      amount: monthPay?.sunday || 0,
    },
    {
      label: "Jours fériés",
      quantity: `${monthPay?.holidayCount || 0} concerné${s(monthPay?.holidayCount || 0)}`,
      amount: monthPay?.holiday || 0,
    },
    {
      label: "Heures supplémentaires payées",
      quantity: minutesLabel(overtimeForPayMonth.totalMinutes),
      amount: overtimeForPayMonth.ready ? overtimeForPayMonth.amount : null,
    },
    {
      label: "Mécénats",
      quantity: minutesLabel(mecenatForPayMonth.totalMinutes),
      amount: mecenatForPayMonth.grossAmountCents / 100,
    },
    {
      label: "Grève",
      quantity: monthPay?.strikeDeductedDays || monthPay?.strikePotentialDays
        ? `${monthPay?.strikeDeductedDays || 0} journée${s(monthPay?.strikeDeductedDays || 0)} retenue${s(monthPay?.strikeDeductedDays || 0)}${monthPay?.strikeAutomaticDays ? ` dont ${monthPay.strikeAutomaticDays} repos noir${s(monthPay.strikeAutomaticDays)}` : ""}${monthPay?.strikePotentialDays ? ` · ${monthPay.strikePotentialDays} jour${s(monthPay.strikePotentialDays)} à vérifier` : ""}`
        : "Aucune journée de grève",
      amount: monthPay?.strikeDeductedDays || monthPay?.strikePotentialDays
        ? monthPay?.strikeDeductedDays && !isContractuel && strikeForPayMonth.totalDeduction !== null
          ? -strikeForPayMonth.totalDeduction
          : null
        : 0,
    },
  ];
  const variableTotal = variableRows.reduce(
    (total, row) => total + (row.amount || 0),
    0,
  );

  const holidayChoice = (item: HolidayAllowanceItem) => (
    item.choice && holidayChoiceEditing !== item.key ? (
      <button
        type="button"
        className="holiday-pay-amount"
        onClick={() => onEditHolidayChoice(item.key)}
        aria-label={`${euros(holidayAllowance(baseSalary, item.choice))}. Modifier le choix de compensation du ${shortDate(item.key)}`}
        title="Cliquer pour modifier le choix"
      >
        {euros(holidayAllowance(baseSalary, item.choice))}
      </button>
    ) : (
      <ChoicePicker
        value={item.choice || ""}
        options={HOLIDAY_PAY_OPTIONS}
        onChange={(choice) => {
          if (!choice) return;
          onEditHolidayChoice(null);
          void onChooseHolidayPay(item.key, choice);
        }}
        ariaLabel={`Choisir la compensation du ${shortDate(item.key)}`}
        className="holiday-pay-picker"
        layout="list"
        placeholder="À décider"
      />
    )
  );

  return (
    <>
      <section className="allowance-card variable-pay-card" aria-labelledby="variable-pay-title">
        <header
          role="button"
          tabIndex={0}
          aria-expanded={payPeriodOpen}
          onClick={onTogglePayPeriod}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onTogglePayPeriod();
          }}
        >
          <div className="pay-period-toggle">
            <span>
              <span className="step-label">Primes pour le mois</span>
              <span className="pay-period-month">
                <h3 id="variable-pay-title">{MONTHS[month]} {year}</h3>
                <span className="pay-period-chevron" aria-hidden="true">
                  <svg viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" /></svg>
                </span>
              </span>
            </span>
          </div>
          <div className="variable-pay-heading-actions">
            <div className="pay-month-nav compact">
              <button type="button" className="pay-nav-arrow" onClick={(event) => { event.stopPropagation(); onChangeMonth(-1); }} aria-label="Mois précédent">
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
              </button>
              <button type="button" className="pay-nav-arrow" onClick={(event) => { event.stopPropagation(); onChangeMonth(1); }} aria-label="Mois suivant">
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
              </button>
              <button type="button" className="pay-today-button" onClick={(event) => { event.stopPropagation(); onGoToday(); }}>
                Aujourd’hui
              </button>
            </div>
            <span className="variable-pay-total">
              <small>{payPeriodOpen ? "Fermer les détails" : "Ouvrir pour les détails"}</small>
              <strong>{euros(variableTotal)} <em>brut variable</em></strong>
            </span>
          </div>
        </header>
        {payPeriodOpen ? <div className="variable-pay-list">
          {variableRows.map((row) => (
            <article key={row.label}>
              <span><strong>{row.label}</strong><small>{row.quantity}</small></span>
              <b className={row.amount === null ? "pending" : ""}>
                {row.amount === null ? "À calculer" : euros(row.amount)}
              </b>
            </article>
          ))}
        </div> : null}
      </section>

      <section className="allowance-overview" aria-labelledby="allowance-overview-title">
        <div className="allowance-overview-heading">
          <div>
            <span className="step-label">Résumé {allowances.year}</span>
            <h3 id="allowance-overview-title">Mes primes en un coup d’œil</h3>
          </div>
        </div>
        <div className="allowance-overview-grid">
          <article>
            <span>Dimanches travaillés</span>
            <strong>{allowances.sundayDone}</strong>
            <small>{allowances.sundayLeft} encore à venir</small>
          </article>
          <article>
            <span>Jours fériés dans l’année</span>
            <strong>{allowances.holidays.length}</strong>
            <small>
              {allowances.cancelledHolidays.length
                ? `${allowances.cancelledHolidays.length} annulé${s(allowances.cancelledHolidays.length)}`
                : allowances.holidayPending
                  ? `${allowances.holidayPending} à préciser`
                  : "Tous renseignés"}
            </small>
          </article>
          <article>
            <span>Primes variables prévues</span>
            <strong>{euros(allowances.monthlyTotal)}</strong>
            <small>hors forfait mensuel</small>
          </article>
        </div>
        {allowances.holidayPending ? (
          <div className="allowance-summary-alert">
            <span aria-hidden="true">!</span>
            <strong>
              {allowances.holidayPending} jour{s(allowances.holidayPending)} férié{s(allowances.holidayPending)} à préciser
            </strong>
            <small>Choisissez la compensation dans le détail ci-dessous.</small>
          </div>
        ) : null}
      </section>

      <div className="allowance-detail-stack">
        <section className="allowance-card">
          <header>
            <span>Dimanches {allowances.year}</span>
            <strong>
              {allowances.sundayDone} <em>faits</em> · {allowances.sundayLeft}{" "}
              <em>à venir</em>
            </strong>
          </header>
          <p className="allowance-note">
            {allowances.sundayDone} fait sur {allowances.sundaysScheduledPast}{" "}
            à ce jour
          </p>
          <table className="allowance-table">
            <tbody>
              {SUNDAY_TIERS.map((tier) => {
                const size = Number.isFinite(tier.to)
                  ? tier.to - tier.from + 1
                  : 0;
                const reached = Math.max(
                  0,
                  Math.min(
                    allowances.sundayDone,
                    size ? tier.to : allowances.sundayDone,
                  ) - (tier.from - 1),
                );
                const current = tier.label === allowances.tier.label;
                return (
                  <tr key={tier.label} className={current ? "current" : ""}>
                    <th scope="row">
                      Socle {tier.label}
                      {current ? <small>vous y êtes</small> : null}
                    </th>
                    <td>
                      {size ? (
                        <>
                          <span className="allowance-progress">
                            <i style={{ width: `${(reached / size) * 100}%` }} />
                          </span>
                          {reached} / {size}
                        </>
                      ) : reached}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="allowance-note">
            {allowances.sundayCount} dimanches sur l’année.{" "}
            {sundayTotal.unpaid
              ? `${sundayTotal.unpaid} au-delà du ${SUNDAY_ALLOWANCE.paidUntil}e : travaillés pour rien.`
              : `Plafond à ${SUNDAY_ALLOWANCE.paidUntil}, vous restez en dessous.`}
          </p>
        </section>

        <section className="allowance-card">
          <header>
            <span>Jours fériés {allowances.year}</span>
            <strong>{allowances.holidays.length} <em>travaillés</em></strong>
          </header>
          {allowances.holidays.length || allowances.cancelledHolidays.length ? (
            <table className="allowance-table">
              <tbody>
                {allowances.holidays.map((item) => (
                  <tr key={item.key}>
                    <th scope="row">
                      {item.name}
                      <small>{shortDate(item.key)} · {holidayPayslip(item.key).label}</small>
                    </th>
                    <td className={item.choice ? "" : "pending"}>
                      <div className="holiday-pay-cell">{holidayChoice(item)}</div>
                    </td>
                  </tr>
                ))}
                {allowances.cancelledHolidays.map((item) => (
                  <tr key={`cancelled-${item.key}`} className="holiday-cancelled">
                    <th scope="row">
                      {item.name}
                      <small>{shortDate(item.key)}</small>
                    </th>
                    <td><strong>Annulé</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="allowance-note">Aucun férié travaillé cette année.</p>
          )}
          {allowances.holidayPending ? (
            <p className="allowance-note warn">
              {allowances.holidayPending} férié{s(allowances.holidayPending)} sans compensation choisie :
              cliquez sur « À décider » pour trancher.
            </p>
          ) : null}
        </section>

        {allowances.compensated.length > 0 && (
          <section className="allowance-card">
            <header>
              <span>Fériés compensés {allowances.year}</span>
              <strong>{allowances.compensated.length} <em>non travaillés</em></strong>
            </header>
            <table className="allowance-table">
              <tbody>
                {allowances.compensated.map((item) => (
                  <tr key={item.key}>
                    <th scope="row">
                      {item.name}
                      <small>{shortDate(item.key)} · paie de février {allowances.year + 1}</small>
                    </th>
                    <td className={item.choice ? "" : "pending"}>
                      <div className="holiday-pay-cell">{holidayChoice(item)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
