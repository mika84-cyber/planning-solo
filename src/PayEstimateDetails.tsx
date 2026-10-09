import { useState } from "react";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES } from "./mecenat";
import { minutesLabel, type WorkQuota } from "./overtime";
import { MONTHS, fromKey, longDate } from "./planningLogic";
import "./payTotals.css";

export type PayCalculationRow = {
  key: string;
  label: string;
  detail: string;
  amount: number | null;
};

export type PayCalculationBreakdown = {
  grossComposition: PayCalculationRow[];
  grossDeductions: PayCalculationRow[];
  grossBeforeDeductions: number;
  variableAdditions: number;
  netRatioFixed: number;
  netRatioVariable: number;
  estimatedContributions: number | null;
  navigo: number;
  mealVoucherDeduction: number;
  netBeforeTax: number | null;
  pasRate: number;
  incomeTax: number | null;
  totalDeductions: number | null;
};

type OvertimePayDetails = {
  totalMinutes: number;
  performedMonth: number;
  performedYear: number;
  ready: boolean;
  amount: number;
  hourlyBase: number;
  lines: Array<{
    entryId: string;
    date: string;
    dayMinutes: number;
    sundayHolidayMinutes: number;
    nightMinutes: number;
    amount: number;
  }>;
};

type MecenatPayDetails = {
  grossAmountCents: number;
  lines: Array<{
    id: string;
    date: string;
    start: string;
    end: string;
    dayMinutes: number;
    nightMinutes: number;
    grossAmountCents: number;
  }>;
};

type PayEstimateDetailsProps = {
  monthIndex: number;
  year: number;
  gross: number;
  grossEstimateComplete: boolean;
  net: number | null;
  calculation: PayCalculationBreakdown;
  overtime: OvertimePayDetails;
  workQuota: WorkQuota;
  mecenat: MecenatPayDetails;
  reliability: {
    tone: "exact" | "estimated" | "incomplete";
    label: string;
    detail: string;
    /** Simple estimation avec le profil de l'année : rien à signaler. */
    quiet?: boolean;
  };
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export function PayEstimateDetails({
  monthIndex,
  year,
  gross,
  grossEstimateComplete,
  net,
  calculation,
  overtime,
  workQuota,
  mecenat,
  reliability,
  onPreviousMonth,
  onNextMonth,
  onToday,
}: PayEstimateDetailsProps) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
  return (
    <section className="allowance-card allowance-card-lead">
      <header className="pay-detail-month-heading">
        <div>
          <span>Détail de la paie du mois affiché</span>
          <strong>
            {MONTHS[monthIndex]} {year}
          </strong>
        </div>
        <div className="pay-month-nav compact pay-detail-month-nav">
          <button
            type="button"
            className="pay-nav-arrow"
            onClick={onPreviousMonth}
            aria-label="Mois précédent"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m12.5 5-5 5 5 5" />
            </svg>
          </button>
          <button
            type="button"
            className="pay-nav-arrow"
            onClick={onNextMonth}
            aria-label="Mois suivant"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m7.5 5 5 5-5 5" />
            </svg>
          </button>
          {/* Seulement loin du mois en cours : sinon il ne sert à rien. */}
          {isCurrentMonth ? null : (
            <button type="button" className="pay-today-button" onClick={onToday}>
              Aujourd’hui
            </button>
          )}
        </div>
      </header>
      {reliability.quiet ? null : <div className={`pay-reliability ${reliability.tone}`} role="status">
        <span aria-hidden="true">
          {reliability.tone === "exact" ? "✓" : reliability.tone === "incomplete" ? "!" : "≈"}
        </span>
        <p>
          <strong>{reliability.label}</strong>
          <small>{reliability.detail}</small>
        </p>
      </div>}
      {/* Les quatre totaux d'abord ; un appui sur une case explique son
          calcul, ligne à ligne. Le détail complet suit. */}
      <PayTotalsExplained gross={gross} grossEstimateComplete={grossEstimateComplete} net={net} calculation={calculation} />
      <section className="pay-calculation-section" aria-labelledby="gross-composition-title">
        <h3 id="gross-composition-title">Composition du brut</h3>
        <table className="allowance-table pay-calculation-table">
          <tbody>
            {calculation.grossComposition.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  {row.label}
                  <small>{row.detail}</small>
                </th>
                <td
                  className={
                    row.amount !== null && row.amount < 0
                      ? "negative"
                      : row.amount !== null && row.amount > 0
                        ? "positive"
                        : ""
                  }
                >
                  {row.amount === null ? "À compléter" : euros(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pay-calculation-gross-before">
          Brut avant retenues liées au calendrier : <strong>{euros(calculation.grossBeforeDeductions)}</strong>
        </p>
        {calculation.grossDeductions.length ? (
          <>
            <h4>Retenues appliquées au brut</h4>
            <table className="allowance-table pay-calculation-table">
              <tbody>
                {calculation.grossDeductions.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}<small>{row.detail}</small></th>
                    <td className="negative">{row.amount === null ? "À vérifier" : `-${euros(row.amount)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </section>

      <section className="pay-calculation-section" aria-labelledby="net-breakdown-title">
        <h3 id="net-breakdown-title">Retenues et passage au net</h3>
        <table className="allowance-table pay-calculation-table">
          <tbody>
            <tr>
              <th scope="row">Cotisations estimées<small>Part fixe conservée à {calculation.netRatioFixed.toLocaleString("fr-FR")} % · part variable à {calculation.netRatioVariable.toLocaleString("fr-FR")} %</small></th>
              <td className="negative">{calculation.estimatedContributions === null ? "À compléter" : `−${euros(calculation.estimatedContributions)}`}</td>
            </tr>
            {calculation.navigo ? <tr><th scope="row">Remboursement Navigo<small>ajouté après cotisations</small></th><td className="positive">+{euros(calculation.navigo)}</td></tr> : null}
            {calculation.mealVoucherDeduction ? <tr><th scope="row">Titres repas<small>retenue du mois</small></th><td className="negative">−{euros(calculation.mealVoucherDeduction)}</td></tr> : null}
            <tr className="pay-calculation-subtotal"><th scope="row">Net avant prélèvement à la source</th><td>{calculation.netBeforeTax === null ? "À compléter" : euros(calculation.netBeforeTax)}</td></tr>
            <tr>
              <th scope="row">Prélèvement à la source<small>Taux enregistré : {calculation.pasRate.toLocaleString("fr-FR")} %</small></th>
              <td className="negative">{calculation.incomeTax === null ? "À compléter" : `−${euros(calculation.incomeTax)}`}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {overtime.totalMinutes ? (
        <div className="overtime-pay-detail">
          <div className="overtime-pay-detail-heading">
            <div>
              <strong>Heures supplémentaires</strong>
              <span>
                Effectuées en {MONTHS[overtime.performedMonth]} {overtime.performedYear}
              </span>
            </div>
            <strong>{overtime.ready ? euros(overtime.amount) : "À compléter"}</strong>
          </div>
          {overtime.ready ? (
            <>
              <p>
                Base horaire : {euros(overtime.hourlyBase)}/h.{" "}
                {workQuota === "full"
                  ? `14 premières heures : ${euros(overtime.hourlyBase * 1.25)}/h de jour, ${euros(overtime.hourlyBase * 1.25 * (5 / 3))}/h le dimanche ou un jour férié et ${euros(overtime.hourlyBase * 1.25 * 2)}/h de nuit. À partir de la 15e : ${euros(overtime.hourlyBase * 1.27)}/h de jour, ${euros(overtime.hourlyBase * 1.27 * (5 / 3))}/h le dimanche ou un jour férié et ${euros(overtime.hourlyBase * 1.27 * 2)}/h de nuit.`
                  : "À temps partiel, le taux de base s’applique sans coefficient 1,25/1,27 ni majoration de nuit ou de dimanche/jour férié."}
              </p>
              <div className="overtime-pay-lines">
                {overtime.lines.map((line) => (
                  <article key={line.entryId}>
                    <div>
                      <strong>{longDate(fromKey(line.date))}</strong>
                      <span>
                        {line.dayMinutes ? `${minutesLabel(line.dayMinutes)} de jour` : ""}
                        {line.dayMinutes && (line.sundayHolidayMinutes || line.nightMinutes) ? " · " : ""}
                        {line.sundayHolidayMinutes
                          ? `${minutesLabel(line.sundayHolidayMinutes)} dimanche/jour férié`
                          : ""}
                        {line.sundayHolidayMinutes && line.nightMinutes ? " · " : ""}
                        {line.nightMinutes
                          ? `${minutesLabel(line.nightMinutes)} de nuit`
                          : ""}
                      </span>
                    </div>
                    <strong>{euros(line.amount)}</strong>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p>
              Renseignez le traitement de base pour calculer automatiquement les
              tarifs et le montant brut.
            </p>
          )}
        </div>
      ) : null}
      {mecenat.lines.length ? (
        <div className="overtime-pay-detail mecenat-pay-detail">
          <div className="overtime-pay-detail-heading">
            <div>
              <strong>Mécénats</strong>
              <span>Tarifs fixes, indépendants de la quotité et des IHTS</span>
            </div>
            <strong>{euros(mecenat.grossAmountCents / 100)}</strong>
          </div>
          <p>
            {euros(MECENAT_REGULATORY_RATES.dayRateCents / 100)}/h de 7 h à 22 h ·{" "}
            {euros(MECENAT_REGULATORY_RATES.nightRateCents / 100)}/h de 22 h à 7 h.
          </p>
          <div className="overtime-pay-lines">
            {mecenat.lines.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>
                    {longDate(fromKey(entry.date))} · {entry.start} → {entry.end}
                  </strong>
                  <span>
                    {entry.dayMinutes
                      ? `${minutesLabel(entry.dayMinutes)} tarif jour (${euros(
                          (entry.dayMinutes / 60) *
                            (MECENAT_REGULATORY_RATES.dayRateCents / 100),
                        )})`
                      : ""}
                    {entry.dayMinutes && entry.nightMinutes ? " · " : ""}
                    {entry.nightMinutes
                      ? `${minutesLabel(entry.nightMinutes)} tarif nuit (${euros(
                          (entry.nightMinutes / 60) *
                            (MECENAT_REGULATORY_RATES.nightRateCents / 100),
                        )})`
                      : ""}
                  </span>
                </div>
                <strong>{euros(entry.grossAmountCents / 100)}</strong>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type TotalKey = "gross" | "variable" | "deductions" | "net";
type ExplainStep = {
  label: string;
  detail?: string;
  amount: number | null;
  /** « + », « − » ou « » (premier terme) ; « = » pour un total. */
  sign: "" | "+" | "−" | "=";
};

/** Lignes qui changent d'un mois à l'autre (forfait des dimanches compris). */
const VARIABLE_KEYS = ["sunday-flat", "sundays", "holidays", "compensated", "overtime", "mecenat", "cia"];
const percent = (value: number) => `${value.toLocaleString("fr-FR")} %`;

/**
 * Les quatre totaux du mois. Chaque case s'ouvre sur son calcul : les
 * montants qui la composent, dans l'ordre, jusqu'au total affiché.
 */
function PayTotalsExplained({
  gross,
  grossEstimateComplete,
  net,
  calculation,
}: {
  gross: number;
  grossEstimateComplete: boolean;
  net: number | null;
  calculation: PayCalculationBreakdown;
}) {
  const [open, setOpen] = useState<TotalKey | null>(null);
  const brut = grossEstimateComplete ? gross : null;
  const fixedPart = gross - calculation.variableAdditions;
  const termsOf = (rows: PayCalculationRow[]): ExplainStep[] =>
    rows.map((row, index) => ({ label: row.label, amount: row.amount, sign: index ? "+" : "" }));
  const explanations: Record<TotalKey, { title: string; intro: string; steps: ExplainStep[] }> = {
    gross: {
      title: "Comment est calculé le total brut",
      intro: "Votre traitement, vos indemnités et vos primes du mois, moins ce qui est retenu pour une absence (maladie, grève).",
      steps: [
        ...termsOf(calculation.grossComposition),
        ...calculation.grossDeductions.map((row) => ({ label: row.label, amount: row.amount, sign: "−" as const })),
        { label: "Total brut", amount: brut, sign: "=" },
      ],
    },
    variable: {
      title: "Comment sont calculés les ajouts variables",
      intro: "Ce qui change d’un mois à l’autre. Ces montants sont déjà compris dans le brut et supportent moins de cotisations que le traitement.",
      steps: [
        ...termsOf(calculation.grossComposition.filter((row) => VARIABLE_KEYS.includes(row.key))),
        { label: "Total des ajouts variables", amount: calculation.variableAdditions, sign: "=" },
      ],
    },
    deductions: {
      title: "Comment est calculé le total des retenues",
      intro: "Tout ce qui est retiré du brut avant d’arriver sur votre compte.",
      steps: [
        ...calculation.grossDeductions.map((row) => ({ label: row.label, detail: "retenue sur le brut", amount: row.amount, sign: "−" as const })),
        {
          label: "Cotisations sociales",
          detail: `On garde ${percent(calculation.netRatioFixed)} de la partie fixe (${euros(fixedPart)}) et ${percent(calculation.netRatioVariable)} des ajouts variables (${euros(calculation.variableAdditions)}) : le reste part en cotisations.`,
          amount: calculation.estimatedContributions,
          sign: "−",
        },
        ...(calculation.mealVoucherDeduction
          ? [{ label: "Titres repas", detail: "votre part du mois", amount: calculation.mealVoucherDeduction, sign: "−" as const }]
          : []),
        {
          label: "Impôt sur le revenu",
          detail: `Prélèvement à la source : ${percent(calculation.pasRate)} du net imposable.`,
          amount: calculation.incomeTax,
          sign: "−",
        },
        { label: "Total des retenues", amount: calculation.totalDeductions === null ? null : -calculation.totalDeductions, sign: "=" },
      ],
    },
    net: {
      title: "Comment est calculé le net estimé",
      intro: "Ce qui arrive sur votre compte : le brut, moins les cotisations, puis moins l’impôt.",
      steps: [
        { label: "Total brut", amount: brut, sign: "" },
        { label: "Cotisations sociales", amount: calculation.estimatedContributions, sign: "−" },
        ...(calculation.navigo ? [{ label: "Remboursement Navigo", amount: calculation.navigo, sign: "+" as const }] : []),
        ...(calculation.mealVoucherDeduction ? [{ label: "Titres repas", amount: calculation.mealVoucherDeduction, sign: "−" as const }] : []),
        { label: "Net avant impôt", amount: calculation.netBeforeTax, sign: "=" },
        { label: `Impôt (${percent(calculation.pasRate)})`, amount: calculation.incomeTax, sign: "−" },
        { label: "Net estimé", amount: net, sign: "=" },
      ],
    },
  };
  const cards: Array<{ key: TotalKey; label: string; value: string; note: string }> = [
    { key: "gross", label: "Total brut", value: brut === null ? "À compléter" : euros(brut), note: "avant cotisations et impôt" },
    { key: "variable", label: "Total des ajouts variables", value: euros(calculation.variableAdditions), note: "déjà compris dans le brut" },
    {
      key: "deductions",
      label: "Total des retenues",
      value: calculation.totalDeductions === null ? "À compléter" : `−${euros(calculation.totalDeductions)}`,
      note: "cotisations, impôt, absences",
    },
    { key: "net", label: "Net estimé final", value: net === null ? "À compléter" : euros(net), note: "ce que vous recevez" },
  ];
  const explanation = open ? explanations[open] : null;
  return (
    <>
      <p className="pay-totals-hint">Touchez une case pour voir son calcul.</p>
      <section className="pay-calculation-totals" aria-label="Totaux du calcul">
        {cards.map((card) => (
          <article key={card.key} className={`${card.key === "net" ? "net" : ""}${open === card.key ? " open" : ""}`.trim() || undefined}>
            <button
              type="button"
              aria-expanded={open === card.key}
              aria-controls="pay-total-explain"
              onClick={() => setOpen((current) => (current === card.key ? null : card.key))}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
              <em>{open === card.key ? "Masquer le calcul" : "Voir le calcul"}<i aria-hidden="true">›</i></em>
            </button>
          </article>
        ))}
      </section>
      {explanation ? (
        <section id="pay-total-explain" className="pay-total-explain" aria-label={explanation.title}>
          <h4>{explanation.title}</h4>
          <p>{explanation.intro}</p>
          <ol>
            {explanation.steps.map((step) => (
              <li key={`${step.sign}${step.label}`} className={step.sign === "=" ? "total" : undefined}>
                <span>
                  {step.label}
                  {step.detail ? <small>{step.detail}</small> : null}
                </span>
                <b>
                  {step.amount === null
                    ? "à compléter"
                    : `${step.sign === "+" || step.sign === "−" ? `${step.sign} ` : step.amount < 0 ? "− " : ""}${euros(Math.abs(step.amount))}`}
                </b>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
