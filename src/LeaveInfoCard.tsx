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

/** « Infos congés » : une ligne au-dessus des soldes, qui se déplie sur le
 *  report des congés annuels, le fractionnement des agents d'accueil et le
 *  barème des congés exceptionnels. */
export function LeaveInfoCard() {
  return (
    <details className="leave-info-card">
      <summary>
        <span className="leave-info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
        </span>
        <span className="leave-info-copy">
          <strong>Infos congés</strong>
          <small>Report, fractionnement et congés exceptionnels</small>
        </span>
        <b aria-hidden="true">⌄</b>
      </summary>
      <div className="leave-info-content">
        <section aria-labelledby="leave-info-carry">
          <h3 id="leave-info-carry">Report des congés annuels</h3>
          <p>
            Les congés annuels d’une année peuvent se prendre jusqu’au 30 avril de l’année suivante. De janvier à
            avril, ce sont eux qui partent en premier. Les RTT, eux, se prennent avant le 31 décembre.
          </p>
        </section>
        <section aria-labelledby="leave-info-fraction">
          <h3 id="leave-info-fraction">Jours de fractionnement</h3>
          <p>
            Les congés annuels posés entre novembre et avril, c’est-à-dire hors de la période de mai à octobre,
            vous donnent des jours en plus :
          </p>
          <dl>
            <div>
              <dt>4 à 6,5 jours posés</dt>
              <dd>1 jour de fractionnement</dd>
            </div>
            <div>
              <dt>7 jours ou plus</dt>
              <dd>2 jours de fractionnement</dd>
            </div>
          </dl>
          <p className="leave-info-note">
            Les RTT ne comptent pas et une demi-journée compte pour moitié. Le calcul se fait tout seul dans vos
            soldes à partir de 2027.
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
