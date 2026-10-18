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

/** Chevron commun aux trois lignes ; il pivote quand la ligne est ouverte. */
const CHEVRON = <svg className="leave-info-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

/** « Règles des congés » au-dessus des soldes : un menu déroulant, fermé au
 *  départ, qui s'ouvre sur trois lignes (titre et l'essentiel en une phrase),
 *  chacune se dépliant sur son détail — report, fractionnement des agents
 *  d'accueil, barème des congés exceptionnels. */
export function LeaveInfoCard() {
  return (
    <details className="leave-info-card">
      <summary className="leave-info-title">
        <strong>Règles des congés</strong>
        {CHEVRON}
      </summary>
      <div className="leave-info-list">
        {/* Report : deux échéances, chacune avec sa date en éphéméride et les
            congés qu'elle concerne. */}
        <details className="leave-info-row leave-info-carry">
          <summary>
            <span className="leave-info-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4m6-4v4" /></svg></span>
            <span className="leave-info-row-copy">
              <strong>Report des congés</strong>
              <small>30 avril · RTT au 31 décembre</small>
            </span>
            {CHEVRON}
          </summary>
          <div className="leave-info-row-body">
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
          </div>
        </details>
        <details className="leave-info-row leave-info-fraction">
          <summary>
            <span className="leave-info-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></span>
            <span className="leave-info-row-copy">
              <strong>Jours de fractionnement</strong>
              <small>+1 j dès 4 j hors saison</small>
            </span>
            {CHEVRON}
          </summary>
          <div className="leave-info-row-body">
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
          </div>
        </details>
        <details className="leave-info-row leave-info-exceptional">
          <summary>
            <span className="leave-info-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 4 2.3 4.7 5.2.8-3.8 3.7.9 5.2L12 16l-4.6 2.4.9-5.2-3.8-3.7 5.2-.8L12 4Z" /></svg></span>
            <span className="leave-info-row-copy">
              <strong>Congés exceptionnels</strong>
              <small>{EXCEPTIONAL_LEAVE_RULES.length} situations, sur justificatif</small>
            </span>
            {CHEVRON}
          </summary>
          <div className="leave-info-row-body">
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
          </div>
        </details>
      </div>
    </details>
  );
}
