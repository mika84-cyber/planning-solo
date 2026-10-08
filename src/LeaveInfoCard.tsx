/** Barème des absences exceptionnelles, d'après la note « Demande de
 *  congé » : accordées sur justificatif, à l'appréciation du chef de
 *  service. */
export const EXCEPTIONAL_LEAVE_RULES = [
  { nature: "Mariage ou PACS de l’agent", days: "5 j" },
  { nature: "Mariage ou PACS d’un enfant", days: "3 j" },
  { nature: "Décès ou maladie très grave d’un proche", days: "3 j", note: "Conjoint, enfant, ascendant ou collatéral" },
  { nature: "Naissance ou adoption", days: "3 j", note: "Accordés de droit" },
  { nature: "Déménagement", days: "2 j", note: "Sur demande spéciale à la DRH" },
  { nature: "Autre cas exceptionnel justifié", days: "3 j max", note: "Après avis du chef de service et de la DRH" },
  { nature: "Principales fêtes religieuses", days: "Selon la fête", note: "Des différentes confessions" },
] as const;

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** « Infos congés » : une ligne au-dessus des soldes, qui se déplie sur le
 *  report des congés annuels, le fractionnement des agents d'accueil et le
 *  barème des congés exceptionnels. */
export function LeaveInfoCard() {
  return (
    <details className="leave-info-card">
      <summary>
        {/* Un mémo à part, en bleu ardoise : des règles, pas un solde. */}
        <span className="leave-info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3Z" /><path d="M5 17a3 3 0 0 1 3-3h9.5M9 8.5h5" /></svg>
        </span>
        <span className="leave-info-copy">
          <em className="leave-info-kicker">À savoir</em>
          <strong>Règles des congés</strong>
          <small>Report, fractionnement et congés exceptionnels</small>
        </span>
        <em aria-hidden="true">
          <span className="leave-info-show">Voir les infos</span>
          <span className="leave-info-hide">Masquer</span>
          <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
        </em>
      </summary>
      <div className="leave-info-content">
        <div className="leave-info-sections">
          {/* Report : deux échéances, chacune avec sa date en éphéméride et les
              congés qu'elle concerne. */}
          <section className="leave-info-carry" aria-labelledby="leave-info-carry">
            <h3 id="leave-info-carry">Report des congés</h3>
            <div className="leave-info-deadline">
              <span className="leave-info-date" aria-hidden="true"><b>30</b><small>avril</small></span>
              <span>
                <strong>Jusqu’au 30 avril suivant</strong>
                <ul className="leave-info-tags" aria-label="Congés reportables">
                  <li>Congés annuels</li>
                  <li>Jours de fractionnement</li>
                  <li>Fériés en récupération</li>
                </ul>
                <small>De janvier à avril, ceux de l’année précédente partent en premier.</small>
              </span>
            </div>
            <div className="leave-info-deadline">
              <span className="leave-info-date" aria-hidden="true"><b>31</b><small>déc.</small></span>
              <span>
                <strong>RTT : avant le 31 décembre</strong>
                <small>Sauf versement sur le CET.</small>
              </span>
            </div>
          </section>
          <section className="leave-info-fraction" aria-labelledby="leave-info-fraction">
            <h3 id="leave-info-fraction">Jours de fractionnement</h3>
            <p>Des jours en plus pour les congés annuels posés hors saison :</p>
            <ol className="leave-info-months" aria-label="Mois qui comptent : janvier à avril et novembre à décembre">
              {MONTH_INITIALS.map((initial, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: les douze mois ne changent jamais d'ordre.
                <li key={index} className={index < 4 || index > 9 ? "counts" : undefined}>{initial}</li>
              ))}
            </ol>
            <div className="leave-info-steps">
              <p><strong>4 jours</strong><span>posés</span><b>+1 jour</b></p>
              <p><strong>7 jours</strong><span>ou plus</span><b>+2 jours</b></p>
            </div>
            <small className="leave-info-note">
              Les RTT ne comptent pas, une demi-journée compte pour moitié. Calcul automatique dans vos soldes dès 2027.
            </small>
          </section>
          <section className="leave-info-exceptional" aria-labelledby="leave-info-exceptional">
            <h3 id="leave-info-exceptional">Congés exceptionnels</h3>
            <ul className="leave-info-rows">
              {EXCEPTIONAL_LEAVE_RULES.map((rule) => (
                <li key={rule.nature}>
                  <span>
                    <strong>{rule.nature}</strong>
                    {"note" in rule ? <small>{rule.note}</small> : null}
                  </span>
                  <b>{rule.days}</b>
                </li>
              ))}
            </ul>
            <small className="leave-info-note">Sur justificatif joint à la demande, selon l’appréciation du chef de service.</small>
          </section>
        </div>
        {/* Même bouton que « Masquer les dates » des dimanches : il referme
            le volet sans remonter jusqu'à son titre. */}
        <button
          className="sunday-dates-close"
          type="button"
          style={{ marginTop: 12 }}
          onClick={(event) => {
            const details = event.currentTarget.closest("details");
            if (details) details.open = false;
          }}
        >
          Masquer les infos
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
        </button>
      </div>
    </details>
  );
}
