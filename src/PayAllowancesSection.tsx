import { useState } from "react";
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
  sundayPayslip,
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
  /** Les dimanches travaillés de l'année, dans l'ordre. `past` distingue ceux
   *  déjà faits de ceux que le cycle programme encore. */
  sundays: Array<{ key: string; past: boolean }>;
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
  /** Les minutes déclarées au-delà des vingt-cinq heures indemnisables du
   *  mois : elles ne sont pas payées, et la ligne le dit. */
  cappedMinutes: number;
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
  /* La liste des dimanches faits est repliée par défaut : la carte reste un
     résumé, et on ne déroule les dates que si on vient les vérifier. */
  const [sundayListOpen, setSundayListOpen] = useState(false);
  const sundaysDone = allowances.sundays.filter((item) => item.past);
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
      quantity: overtimeForPayMonth.cappedMinutes
        ? `${minutesLabel(overtimeForPayMonth.totalMinutes)} déclarées · ${minutesLabel(overtimeForPayMonth.cappedMinutes)} au-delà du plafond de 25 h, non payées`
        : minutesLabel(overtimeForPayMonth.totalMinutes),
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
          {/* Le résumé compte ; les dates, elles, vivent dans la carte des
              dimanches, où se lisent déjà les socles. */}
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
            {allowances.sundayDone} dimanche{s(allowances.sundayDone)} effectué{s(allowances.sundayDone)} sur {allowances.sundaysScheduledPast}{" "}
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
          {/* Le détail des dimanches déjà faits se déplie ici, sous les
              socles : la carte reste un résumé tant qu'on ne le demande pas. */}
          <button
            type="button"
            className="allowance-overview-toggle sunday-dates-toggle"
            aria-expanded={sundayListOpen}
            aria-controls="sunday-done-list"
            onClick={() => setSundayListOpen((open) => !open)}
          >
            <span>Dates des dimanches</span>
            <em>
              {sundayListOpen ? "Masquer les dates" : "Voir les dates"}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </em>
          </button>
          {sundayListOpen ? (
            <div id="sunday-done-list" className="sunday-done-list">
              {allowances.sundays.length ? (
                <>
                  {/* Les dimanches à venir y figurent aussi : la paie
                      prévisionnelle les compte déjà, la liste doit donner le
                      même nombre qu'elle. */}
                  <p className="allowance-note">
                    Vos {allowances.sundays.length} dimanche{s(allowances.sundays.length)} de {allowances.year}
                    {allowances.sundays.length > sundaysDone.length
                      ? ` : ${sundaysDone.length} fait${s(sundaysDone.length)}, ${allowances.sundays.length - sundaysDone.length} à venir selon votre cycle`
                      : ""}
                    , dans l’ordre des paies
                  </p>
                  {/* Le rang d'un dimanche dit ce qu'il rapporte : les dix
                      premiers sont dans le forfait mensuel, les suivants sont
                      payés un par un jusqu'au plafond, au-delà rien. */}
                  <p className="sunday-done-legend">
                    <span className="paid">Payé {euros(SUNDAY_ALLOWANCE.perSunday)}</span>
                    <span className="flat">Dans le forfait</span>
                    {allowances.sundays.length > SUNDAY_ALLOWANCE.paidUntil ? <span className="unpaid">Non payé</span> : null}
                    {allowances.sundays.length > sundaysDone.length ? <span className="upcoming">À venir</span> : null}
                  </p>
                  {/* Groupés par paie, puis par mois : c'est ainsi qu'on les
                      retrouve sur un bulletin, et la liste tient en quelques lignes. */}
                  {[...new Set(allowances.sundays.map((item) => sundayPayslip(item.key).label))].map((payslipLabel) => {
                    const paid = allowances.sundays.filter((item) => sundayPayslip(item.key).label === payslipLabel);
                    // Les dimanches de l'année sont dans l'ordre : leur place est leur rang.
                    const rankOf = (item: (typeof paid)[number]) => allowances.sundays.indexOf(item) + 1;
                    const firstRank = rankOf(paid[0]);
                    const lastRank = rankOf(paid[paid.length - 1]);
                    const kindOf = (rank: number) =>
                      rank <= SUNDAY_ALLOWANCE.flatUntil ? "flat" : rank <= SUNDAY_ALLOWANCE.paidUntil ? "paid" : "unpaid";
                    const paidSundays = paid.filter((item) => kindOf(rankOf(item)) === "paid");
                    const paidHere = paidSundays.length;
                    const paidUpcoming = paidSundays.filter((item) => !item.past).length;
                    return (
                      <section className="sunday-done-group" key={payslipLabel}>
                        <p className="sunday-done-group-heading">
                          <strong>{payslipLabel.charAt(0).toUpperCase() + payslipLabel.slice(1)}</strong>
                          <small>{paid.length} dimanche{s(paid.length)} · n° {firstRank}{lastRank > firstRank ? ` à ${lastRank}` : ""}</small>
                        </p>
                        <p className={`sunday-done-group-pay${paidHere ? "" : " none"}`}>
                          {paidHere
                            ? `${paidHere} payé${s(paidHere)} sur cette paie · ${euros(paidHere * SUNDAY_ALLOWANCE.perSunday)}${
                                paidUpcoming
                                  ? paidUpcoming === paidHere
                                    ? " · à venir"
                                    : ` · ${paidHere - paidUpcoming} fait${s(paidHere - paidUpcoming)}, ${paidUpcoming} à venir`
                                  : ""
                              }`
                            : paid.some((item) => kindOf(rankOf(item)) === "flat")
                              ? "Tous compris dans le forfait mensuel"
                              : `Au-delà du ${SUNDAY_ALLOWANCE.paidUntil}e dimanche : non payés`}
                        </p>
                        <table className="allowance-table sunday-done-table">
                          <tbody>
                            {[...new Set(paid.map((item) => Number(item.key.slice(5, 7)) - 1))].map((monthIndex) => {
                              const days = paid.filter((item) => Number(item.key.slice(5, 7)) - 1 === monthIndex);
                              return (
                                <tr key={monthIndex}>
                                  <th scope="row">{MONTHS[monthIndex]}</th>
                                  <td>
                                    {days.map((item, index) => {
                                      const rank = rankOf(item);
                                      const kind = kindOf(rank);
                                      return (
                                        <span key={item.key}>
                                          {index ? ", " : ""}
                                          <span
                                            className={`sunday-day ${kind}${item.past ? "" : " upcoming"}`}
                                            title={`${rank}${rank === 1 ? "er" : "e"} dimanche · ${kind === "paid" ? "payé" : kind === "flat" ? "dans le forfait" : "non payé"}${item.past ? "" : " · à venir"}`}
                                          >
                                            {Number(item.key.slice(8, 10))}
                                          </span>
                                        </span>
                                      );
                                    })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </section>
                    );
                  })}
                </>
              ) : (
                <p className="allowance-note">
                  Aucun dimanche travaillé pour le moment.
                </p>
              )}
            </div>
          ) : null}
        </section>

        {/* Ancre : l'accueil renvoie ici quand des fériés restent à trancher. */}
        <section className="allowance-card" id="holiday-choices">
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
