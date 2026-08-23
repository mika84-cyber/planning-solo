import type { StrikePayEstimate } from "./strike";

const fullDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function asDate(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

function dateSpan(keys: string[]) {
  if (!keys.length) return "";
  if (keys.length === 1) return fullDate.format(asDate(keys[0]));
  const first = asDate(keys[0]);
  const last = asDate(keys[keys.length - 1]);
  if (first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear())
    return `${first.getUTCDate()}–${fullDate.format(last)}`;
  return `${shortDate.format(first)}–${fullDate.format(last)}`;
}

function euros(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function StrikeContinuityDetails({
  estimate,
}: {
  estimate: StrikePayEstimate;
}) {
  const protectedIntervals = estimate.continuityIntervals.filter(
    (interval) => interval.status === "protected-annual",
  );
  const ambiguousIntervals = estimate.continuityIntervals.filter(
    (interval) => interval.status === "ambiguous",
  );
  const confirmedRestIntervals = estimate.continuityIntervals.filter(
    (interval) => interval.status === "confirmed-cycle-rest",
  );
  return (
    <section className="strike-continuity-details" aria-label="Détail de la continuité de grève">
      {protectedIntervals.map((interval) => {
        const annualDates = interval.days
          .filter((day) => day.kind === "annual")
          .map((day) => day.date);
        return (
          <div className="strike-protected-break" key={`${interval.fromStrike}-${interval.toStrike}`}>
            <strong>{dateSpan(annualDates)} : CA validés → non concernés</strong>
            <span>Ces congés restent des CA et interrompent la continuité retenue par l’estimation.</span>
          </div>
        );
      })}
      {confirmedRestIntervals.map((interval) => (
        <div
          className="strike-confirmed-continuity"
          key={`${interval.fromStrike}-${interval.toStrike}`}
        >
          <strong>{dateSpan(interval.days.map((day) => day.date))} : repos noirs inclus dans la retenue</strong>
          <span>
            Encadrés par deux grèves, ces {interval.days.length} jour
            {interval.days.length > 1 ? "s" : ""} de repos comptent dans la période continue au 1/30.
          </span>
          <small>Leur nature reste « repos du cycle » dans le planning.</small>
        </div>
      ))}
      {ambiguousIntervals.map((interval) => (
        <div
          className="strike-continuity-warning"
          role="note"
          key={`${interval.fromStrike}-${interval.toStrike}`}
        >
          <strong>Attention : période de grève continue potentielle — retenue à vérifier</strong>
          <span>
            {dateSpan(interval.days.map((day) => day.date))} :{" "}
            {[...new Set(interval.days.map((day) => day.label))].join(" · ")}
          </span>
          <small>
            Ces jours ne sont pas transformés en grève et ne sont pas déduits automatiquement.
          </small>
        </div>
      ))}
      <footer>
        <strong>
          Total retenue estimée sur {estimate.days.length + estimate.automaticAdditionalDays.length} journée
          {estimate.days.length + estimate.automaticAdditionalDays.length > 1 ? "s" : ""} :{" "}
          {estimate.totalDeduction === null ? "à calculer" : `−${euros(estimate.totalDeduction)} € brut`}
        </strong>
        {estimate.automaticAdditionalDays.length ? (
          <span>
            {estimate.days.length} journée{estimate.days.length > 1 ? "s" : ""} de grève posée
            {estimate.days.length > 1 ? "s" : ""} + {estimate.automaticAdditionalDays.length} repos noir
            {estimate.automaticAdditionalDays.length > 1 ? "s" : ""} compris dans la période continue.
          </span>
        ) : null}
        {estimate.potentialAdditionalDays.length ? (
          <span>
            Jusqu’à {estimate.potentialAdditionalDays.length} jour
            {estimate.potentialAdditionalDays.length > 1 ? "s" : ""} intermédiaire
            {estimate.potentialAdditionalDays.length > 1 ? "s" : ""} supplémentaire
            {estimate.potentialAdditionalDays.length > 1 ? "s" : ""} à vérifier
            {estimate.maximumDeductionIfContinuous === null
              ? "."
              : ` — maximum potentiel : −${euros(estimate.maximumDeductionIfContinuous)} € brut.`}
          </span>
        ) : null}
        <small>
          {estimate.exactMonthValues
            ? "Calculé avec les valeurs exactes du mois."
            : estimate.sourcePeriod
              ? `Estimation avec les dernières valeurs connues (${estimate.sourcePeriod}).`
              : "Traitement et indemnité de résidence à compléter pour chiffrer la retenue."}
        </small>
      </footer>
    </section>
  );
}
