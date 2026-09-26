import { FRACTION_RULES, type FractionCategory } from "./fractionRules";

/** Barème des absences exceptionnelles, d'après la note « Demande de
 *  congé » : accordées sur justificatif, à l'appréciation du chef de
 *  service. */
export const EXCEPTIONAL_LEAVE_RULES = [
  { nature: "Mariage ou PACS de l’agent", days: "5 jours" },
  { nature: "Mariage ou PACS d’un de ses enfants", days: "3 jours" },
  { nature: "Décès ou maladie très grave du conjoint, d’un enfant, d’un ascendant ou d’un collatéral", days: "3 jours" },
  { nature: "Naissance ou adoption", days: "3 jours, de droit" },
  { nature: "Déménagement", days: "2 jours, sur demande spéciale à la DRH" },
  { nature: "Autre cas exceptionnel justifié", days: "3 jours au plus, après avis du chef de service et de la DRH" },
  { nature: "Principales fêtes religieuses des différentes confessions", days: "Selon le calendrier des fêtes" },
] as const;

function stepLabel(from: number, grant: number, unit: string) {
  const grantText = grant === 0.5 ? `½ ${unit}` : `${grant} ${unit}${grant > 1 ? "s" : ""}`;
  return `${from.toLocaleString("fr-FR")} ${unit}${from > 1 ? "s" : ""} → ${grantText}`;
}

/** Les catégories aux mêmes seuils sont réunies sur une ligne. */
function fractionRows() {
  const rows = new Map<string, { labels: string[]; text: string }>();
  for (const [category, rule] of Object.entries(FRACTION_RULES) as Array<[FractionCategory, (typeof FRACTION_RULES)[FractionCategory]]>) {
    const unit = category.startsWith("asi") || category === "security" ? "garde" : "jour";
    const text = rule.steps.map((step) => stepLabel(step.from, step.grant, unit)).join(" · ");
    const row = rows.get(text) ?? { labels: [], text };
    row.labels.push(rule.label);
    rows.set(text, row);
  }
  return [...rows.values()];
}

/** « Infos congés » : le fonctionnement du fractionnement et le nombre de
 *  jours accordés pour chaque congé exceptionnel. Replié par défaut. */
export function LeaveInfoCard() {
  return (
    <details className="leave-info-card">
      <summary>
        <span className="leave-info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
        </span>
        <span className="leave-info-copy">
          <strong>Infos congés</strong>
          <small>Fractionnement et congés exceptionnels</small>
        </span>
        <b aria-hidden="true">⌄</b>
      </summary>
      <div className="leave-info-content">
        <section aria-labelledby="leave-info-fraction">
          <h3 id="leave-info-fraction">Jours de fractionnement</h3>
          <p>
            Ils sont accordés pour les congés annuels pris hors de la période du 1<sup>er</sup> mai au 31 octobre :
            de janvier à avril, et de novembre au 30 avril suivant. Les RTT n’y comptent pas ; une demi-journée
            compte pour moitié.
          </p>
          <dl>
            {fractionRows().map((row) => (
              <div key={row.text}>
                <dt>
                  {row.labels
                    .map((label, index) => index && label[1] !== label[1].toUpperCase() ? label.charAt(0).toLocaleLowerCase("fr") + label.slice(1) : label)
                    .join(", ")}
                </dt>
                <dd>{row.text}</dd>
              </div>
            ))}
          </dl>
          <p className="leave-info-note">
            Calculés automatiquement dans vos soldes à partir de 2027, selon votre catégorie. À temps partiel, les
            seuils et les jours accordés sont proratisés.
          </p>
        </section>
        <section aria-labelledby="leave-info-exceptional">
          <h3 id="leave-info-exceptional">Congés exceptionnels</h3>
          <p>Accordés sur justificatif joint à la demande, selon l’appréciation du chef de service.</p>
          <dl>
            {EXCEPTIONAL_LEAVE_RULES.map((rule) => (
              <div key={rule.nature}>
                <dt>{rule.nature}</dt>
                <dd>{rule.days}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </details>
  );
}
