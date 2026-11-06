import { useRef, useState } from "react";
import { ChoicePicker } from "./ChoicePicker";
import { euros } from "./appModel";
import {
  DEFAULT_MEAL_VOUCHER_COUNTS,
  faceCentsFromRetention,
  MEAL_VOUCHER_PRESETS,
  MEAL_VOUCHER_TIERS,
  MEAL_VOUCHERS_PER_MONTH,
  MEAL_VOUCHERS_PER_YEAR,
  mealVoucherPlanFor,
  mealVoucherTotal,
  type MealVoucherPlan,
  type MealVoucherPlans,
} from "./mealVouchers";
import { MONTHS, s, YEAR_OPTIONS } from "./planningLogic";
import "./mealVouchers.css";

const SHORT_MONTHS = ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const sameCounts = (left: readonly number[], right: readonly number[]) => left.join() === right.join();

type Props = {
  plans?: MealVoucherPlans;
  initialYear: number;
  /** La retenue connue par le bulletin, qui donne la valeur du titre d'emblée. */
  knownRetention: number;
  onSave: (year: number, plan: MealVoucherPlan) => void;
};

/** Titres repas, dans Ma paie : la valeur du titre, puis le nombre de titres
 *  de chaque mois, d'où vient la retenue de la paie. */
export function MealVouchersScreen({ plans, initialYear, knownRetention, onSave }: Props) {
  const [year, setYear] = useState(initialYear);
  // Chaque année a son brouillon : changer d'année repart de son choix.
  return <MealVoucherYear key={year} year={year} plans={plans} knownRetention={knownRetention} onYearChange={setYear} onSave={onSave} />;
}

function MealVoucherYear({ year, plans, knownRetention, onYearChange, onSave }: Omit<Props, "initialYear"> & { year: number; onYearChange: (year: number) => void }) {
  const saved = plans?.[year];
  const known = mealVoucherPlanFor(plans, year);
  const [faceCents, setFaceCents] = useState(known?.faceCents ?? faceCentsFromRetention(knownRetention));
  const [counts, setCounts] = useState(known?.counts ?? DEFAULT_MEAL_VOUCHER_COUNTS);
  // « Sur mesure » se choisit aussi d'un geste, même si les mois valent encore un modèle.
  const [custom, setCustom] = useState(false);
  // Un essai d'enregistrement sans valeur du titre : la carte le signale.
  const [valueMissing, setValueMissing] = useState(false);
  const months = useRef<HTMLDivElement>(null);
  const valueCard = useRef<HTMLDivElement>(null);
  const total = mealVoucherTotal(counts);
  const excess = total - MEAL_VOUCHERS_PER_YEAR;
  const tier = MEAL_VOUCHER_TIERS.find((item) => item.faceCents === faceCents);
  const preset = custom ? undefined : MEAL_VOUCHER_PRESETS.find((item) => sameCounts(item.counts, counts));
  const unchanged = saved !== undefined && saved.faceCents === faceCents && sameCounts(saved.counts, counts);
  const status = unchanged
    ? `Enregistré pour ${year}`
    : saved
      ? "Modifications à enregistrer"
      : known
        ? "Repris de votre dernier choix"
        : "Par défaut : 20 par mois, rien en décembre";
  const setMonth = (month: number, wanted: number) => {
    const count = Math.max(0, Math.min(MEAL_VOUCHERS_PER_MONTH, wanted));
    setCustom(true);
    setCounts((current) => current.map((value, index) => (index === month ? count : value)));
  };

  const save = () => {
    if (!faceCents || !tier) {
      setValueMissing(true);
      valueCard.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSave(year, { faceCents, counts });
  };

  return (
    <section className="meal-vouchers" aria-label="Mes titres repas">
      <div className="meal-vouchers-head">
        <label className="meal-vouchers-year">
          <span>Année</span>
          <ChoicePicker value={year} options={YEAR_OPTIONS} onChange={onYearChange} ariaLabel="Choisir l’année des titres repas" className="leave-year-picker" />
        </label>
        <p className="meal-vouchers-status">{status}</p>
      </div>

      <div className={`meal-vouchers-card${valueMissing && !tier ? " missing" : ""}`} ref={valueCard}>
        <h3 id="meal-vouchers-value">La valeur de votre titre</h3>
        <p>Elle dépend de votre indice de rémunération.</p>
        <div className="meal-vouchers-values" role="radiogroup" aria-labelledby="meal-vouchers-value">
          {MEAL_VOUCHER_TIERS.map((item) => (
            <button key={item.faceCents} type="button" role="radio" aria-checked={item.faceCents === faceCents} onClick={() => setFaceCents(item.faceCents)}>
              <strong>{euros(item.faceCents / 100)}</strong>
              <small>{item.indices}</small>
              <small>Votre part : {euros(item.agentCents / 100)}</small>
            </button>
          ))}
        </div>
        {valueMissing && !tier ? <p className="meal-vouchers-alert" role="alert">Choisissez la valeur de votre titre pour enregistrer.</p> : null}
      </div>

      <div className="meal-vouchers-card">
        <h3 id="meal-vouchers-months">Vos titres, mois par mois</h3>
        <p>{MEAL_VOUCHERS_PER_MONTH} titres par mois au plus, {MEAL_VOUCHERS_PER_YEAR} sur l’année.</p>
        <p className="meal-vouchers-contact">
          Pour changer votre nombre de titres par mois, écrivez à <a href="mailto:bimpli@centrepompidou.fr">bimpli@centrepompidou.fr</a>.
        </p>
        <div className="meal-vouchers-presets" role="radiogroup" aria-label="Répartition des titres sur l’année">
          {MEAL_VOUCHER_PRESETS.map((item) => (
            <button key={item.key} type="button" role="radio" aria-checked={preset?.key === item.key} onClick={() => { setCustom(false); setCounts(item.counts); }}>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={!preset} onClick={() => { setCustom(true); months.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>
            <strong>Sur mesure</strong>
            <small>Le nombre de votre choix, chaque mois</small>
          </button>
        </div>
        <div className="meal-vouchers-months" ref={months} role="group" aria-labelledby="meal-vouchers-months">
          {counts.map((count, month) => (
            <div key={SHORT_MONTHS[month]} className={count ? undefined : "off"}>
              <span>{SHORT_MONTHS[month]}</span>
              <div className="meal-vouchers-field">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Titres repas en ${MONTHS[month]}`}
                  value={count}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setMonth(month, Number(event.target.value.replace(/\D/g, "")))}
                />
                <button type="button" aria-label={`Un titre de plus en ${MONTHS[month]}`} disabled={count >= MEAL_VOUCHERS_PER_MONTH} onClick={() => setMonth(month, count + 1)}>
                  <svg viewBox="0 0 12 8" aria-hidden="true"><path d="m2 6 4-4 4 4" /></svg>
                </button>
                <button type="button" aria-label={`Un titre de moins en ${MONTHS[month]}`} disabled={count <= 0} onClick={() => setMonth(month, count - 1)}>
                  <svg viewBox="0 0 12 8" aria-hidden="true"><path d="m2 2 4 4 4-4" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="meal-vouchers-card meal-vouchers-total">
        <p><span>Sur l’année</span><b>{total} titre{s(total)} sur {MEAL_VOUCHERS_PER_YEAR}</b></p>
        <span className={`meal-vouchers-bar${excess > 0 ? " over" : ""}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (total / MEAL_VOUCHERS_PER_YEAR) * 100)}%` }} /></span>
        {tier ? <p><span>Votre part sur l’année</span><b>{euros((total * tier.agentCents) / 100)}</b></p> : null}
        {excess > 0 ? <p className="meal-vouchers-alert" role="alert">{excess} titre{s(excess)} de trop : {MEAL_VOUCHERS_PER_YEAR} au plus sur l’année.</p> : null}
        <small>Votre part est retenue sur la paie du mois où vous prenez les titres.</small>
      </div>

      {tier ? null : <p className="meal-vouchers-hint">Choisissez d’abord la valeur de votre titre.</p>}
      {/* Une fois enregistré, une confirmation plutôt qu'un bouton éteint : le
          moindre changement de formule fait revenir « Enregistrer ». */}
      {unchanged ? (
        <p className="meal-vouchers-saved" role="status">
          <strong>Enregistré pour {year}</strong>
          <span>La paie suit ce choix. Pour en changer, choisissez une autre formule et enregistrez de nouveau.</span>
        </p>
      ) : (
        <button type="button" className="primary-action meal-vouchers-save" disabled={excess > 0} onClick={save}>Enregistrer</button>
      )}
    </section>
  );
}
