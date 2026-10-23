import { useState } from "react";
import { euros } from "./appModel";
import { MECENAT_REGULATORY_RATES } from "./mecenat";
import { minutesLabel, type WorkQuota } from "./overtime";
import { MONTHS, fromKey, longDate } from "./planningLogic";
import { PayMonthNav } from "./PayMonthNav";
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
  return (
    <section className="allowance-card allowance-card-lead">
      {/* Le bandeau du haut nomme déjà la page : ici, le mois et ses deux
          flèches, le même navigateur que sur la page principale. */}
      <PayMonthNav month={monthIndex} year={year} onPreviousMonth={onPreviousMonth} onNextMonth={onNextMonth} onToday={onToday} heading="h3" />
      {reliability.quiet ? null : <div className={`pay-reliability ${reliability.tone}`} role="status">
        <span aria-hidden="true">
          {reliability.tone === "exact" ? "✓" : reliability.tone === "incomplete" ? "!" : "≈"}
        </span>
        <p>
          <strong>{reliability.label}</strong>
          <small>{reliability.detail}</small>
        </p>
      </div>}
      {/* Du brut au net ; chaque étape s'ouvre sur son calcul (composition
          du brut, cotisations, passage au net). Rien n'est répété dessous :
          suivent les heures sup et les mécénats, avec leurs lignes. */}
      <PayTotalsExplained gross={gross} grossEstimateComplete={grossEstimateComplete} net={net} calculation={calculation} />
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
                  : "À temps partiel, l’heure vaut le taux d’un temps plein au même indice, sans coefficient 1,25/1,27 ni majoration de nuit ou de dimanche/jour férié ; le plafond de 25 h est ramené à la quotité."}
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

type TotalKey = "gross" | "variable" | "contributions" | "mealVouchers" | "navigo" | "netBeforeTax" | "tax" | "net";
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
 * Du brut au net, étape par étape : le brut (dont les primes du mois), moins
 * les cotisations, les titres repas s'il y en a, plus le Navigo s'il est
 * remboursé, le net avant impôt, moins l'impôt, le net. Chaque étape s'ouvre
 * sur son calcul : les montants qui la composent, jusqu'au total affiché.
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
  const { variableAdditions, estimatedContributions, netBeforeTax, incomeTax, navigo, mealVoucherDeduction, pasRate, netRatioFixed, netRatioVariable } = calculation;
  const fixedPart = gross - variableAdditions;
  const round = (value: number) => Math.round(value * 100) / 100;
  const termsOf = (rows: PayCalculationRow[]): ExplainStep[] =>
    rows.map((row, index) => ({ label: row.label, detail: row.detail, amount: row.amount, sign: index ? "+" : "" }));
  const toNetBeforeTax: ExplainStep[] = [
    { label: "Brut du mois", amount: brut, sign: "" },
    { label: "Cotisations sociales", amount: estimatedContributions, sign: "−" },
    ...(mealVoucherDeduction ? [{ label: "Titres repas", amount: mealVoucherDeduction, sign: "−" as const }] : []),
    ...(navigo ? [{ label: "Remboursement Navigo", amount: navigo, sign: "+" as const }] : []),
    { label: "Net avant impôt", amount: netBeforeTax, sign: "=" },
  ];
  const explanations: Record<TotalKey, { title: string; intro: string; steps: ExplainStep[] }> = {
    gross: {
      title: "Comment est calculé le brut du mois",
      intro: "Votre traitement, vos indemnités et vos primes du mois, moins ce qui est retenu pour une absence (maladie, grève).",
      steps: [
        ...termsOf(calculation.grossComposition),
        ...calculation.grossDeductions.map((row) => ({ label: row.label, detail: row.detail, amount: row.amount, sign: "−" as const })),
        { label: "Brut du mois", amount: brut, sign: "=" },
      ],
    },
    variable: {
      title: "Comment sont calculées les primes du mois",
      intro: "Ce qui change d’un mois à l’autre. Ces montants sont déjà compris dans le brut et supportent moins de cotisations que le traitement.",
      steps: [
        ...termsOf(calculation.grossComposition.filter((row) => VARIABLE_KEYS.includes(row.key))),
        { label: "Primes du mois", amount: variableAdditions, sign: "=" },
      ],
    },
    contributions: {
      title: "Comment sont calculées les cotisations sociales",
      intro: `Retraite, CSG et CRDS. On garde ${percent(netRatioFixed)} de la partie fixe du brut et ${percent(netRatioVariable)} des primes du mois : le reste part en cotisations.`,
      steps: [
        { label: "Sur la partie fixe", detail: `${percent(round(100 - netRatioFixed))} de ${euros(fixedPart)}`, amount: round((fixedPart * (100 - netRatioFixed)) / 100), sign: "" },
        { label: "Sur les primes du mois", detail: `${percent(round(100 - netRatioVariable))} de ${euros(variableAdditions)}`, amount: round((variableAdditions * (100 - netRatioVariable)) / 100), sign: "+" },
        { label: "Cotisations sociales", amount: estimatedContributions, sign: "=" },
      ],
    },
    mealVouchers: {
      title: "Les titres repas",
      intro: "Votre part du mois, retenue sur le net — jamais en décembre.",
      steps: [{ label: "Titres repas", amount: mealVoucherDeduction, sign: "=" }],
    },
    navigo: {
      title: "Le Navigo remboursé",
      intro: "La part de l’abonnement remboursée par l’employeur, ajoutée au net telle quelle, hors cotisations et impôt.",
      steps: [{ label: "Remboursement Navigo", amount: navigo, sign: "=" }],
    },
    netBeforeTax: {
      title: "Comment est calculé le net avant impôt",
      intro: "Le brut, moins les cotisations et les titres repas, plus le Navigo remboursé.",
      steps: toNetBeforeTax,
    },
    tax: {
      title: "Comment est calculé l’impôt sur le revenu",
      intro: `Le prélèvement à la source : votre taux enregistré, ${percent(pasRate)}, appliqué au net imposable — un peu plus large que le net avant impôt, car une part des cotisations reste imposable.`,
      steps: [
        { label: "Net avant impôt", amount: netBeforeTax, sign: "" },
        { label: `Impôt à ${percent(pasRate)}`, detail: "sur le net imposable", amount: incomeTax, sign: "=" },
      ],
    },
    net: {
      title: "Comment est calculé le net estimé",
      intro: "Ce qui arrive sur votre compte : le brut, moins les cotisations, puis moins l’impôt.",
      steps: [
        ...toNetBeforeTax,
        { label: `Impôt (${percent(pasRate)})`, amount: incomeTax, sign: "−" },
        { label: "Net estimé", amount: net, sign: "=" },
      ],
    },
  };
  /* Le fil du brut au net : une étape par ligne, les retenues en rose, le
     Navigo en vert, les paliers (primes comprises, net avant impôt) en
     retrait ; le net ferme la cascade. Chaque ligne se touche pour afficher
     son calcul, ligne à ligne, juste sous elle — et le dit sous son montant. */
  const rows: Array<{ key: TotalKey; kind: "" | "sub" | "minus" | "plus" | "net"; label: string; note?: string; value: string }> = [
    {
      key: "gross",
      kind: "",
      label: "Brut du mois",
      note: calculation.grossDeductions.length ? "traitement, indemnités et primes, moins les absences" : "traitement, indemnités et primes",
      value: brut === null ? "À compléter" : euros(brut),
    },
    { key: "variable", kind: "sub", label: "Dont primes du mois", value: euros(variableAdditions) },
    {
      key: "contributions",
      kind: "minus",
      label: "Cotisations sociales",
      note: "retraite, CSG et CRDS",
      value: estimatedContributions === null ? "À compléter" : `− ${euros(estimatedContributions)}`,
    },
    ...(mealVoucherDeduction
      ? [{ key: "mealVouchers" as const, kind: "minus" as const, label: "Titres repas", note: "votre part du mois", value: `− ${euros(mealVoucherDeduction)}` }]
      : []),
    ...(navigo
      ? [{ key: "navigo" as const, kind: "plus" as const, label: "Navigo remboursé", note: "ajouté au net", value: `+ ${euros(navigo)}` }]
      : []),
    { key: "netBeforeTax", kind: "sub", label: "Net avant impôt", value: netBeforeTax === null ? "À compléter" : euros(netBeforeTax) },
    {
      key: "tax",
      kind: "minus",
      label: "Impôt sur le revenu",
      note: `prélèvement à la source · ${percent(pasRate)}`,
      value: incomeTax === null ? "À compléter" : `− ${euros(incomeTax)}`,
    },
    { key: "net", kind: "net", label: "Net estimé", note: "ce qui arrive sur votre compte", value: net === null ? "À compléter" : euros(net) },
  ];
  const explanation = open ? explanations[open] : null;
  return (
    <>
      <h3 className="pay-totals-kicker">Du brut au net</h3>
      <section className="pay-calculation-totals" aria-label="Du brut au net">
        <ol>
          {rows.map((row) => (
            <li key={row.key} className={[row.kind, open === row.key ? "open" : ""].filter(Boolean).join(" ") || undefined}>
              <button
                type="button"
                aria-expanded={open === row.key}
                aria-controls="pay-total-explain"
                onClick={() => setOpen((current) => (current === row.key ? null : row.key))}
              >
                <i className="pay-total-dot" aria-hidden="true" />
                <span className="pay-total-label">{row.label}{row.note ? <small>{row.note}</small> : null}</span>
                {/* Le montant, et dessous, en toutes lettres, ce qu'un appui fait. */}
                <span className="pay-total-value">
                  <b>{row.value}</b>
                  <em>{open === row.key ? "Masquer le calcul" : "Voir le calcul"}<i aria-hidden="true">›</i></em>
                </span>
              </button>
              {/* Le calcul de l'étape, juste sous sa ligne. */}
              {open === row.key && explanation ? (
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
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
