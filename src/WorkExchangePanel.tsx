import type { WorkExchange } from "./appModel";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { fromKey, longDate } from "./planningLogic";

/** Les deux journées de l'échange, dans l'ordre du calendrier : chacune dit
 *  ce qu'elle devient pour vous (repos ou travail) et qui remplace qui. */
function chronologicalDetails(exchange: WorkExchange) {
  const pronoun = colleagueObjectPronoun(exchange.partnerName);
  return [
    {
      date: exchange.returnDate,
      role: "return" as const,
      tag: "Travail",
      label: `Vous ${pronoun} remplacez le ${longDate(fromKey(exchange.returnDate))}`,
    },
    {
      date: exchange.agreementDate,
      role: "given" as const,
      tag: "Off",
      label: `${exchange.partnerName} vous remplace le ${longDate(fromKey(exchange.agreementDate))}`,
    },
  ].sort((first, second) => first.date.localeCompare(second.date));
}

export function WorkExchangePanel({
  exchanges,
  onEdit,
}: {
  exchanges: WorkExchange[];
  onEdit: (exchange: WorkExchange) => void;
}) {
  if (!exchanges.length) return null;
  return (
    <section className="work-exchange-panel" aria-labelledby="work-exchanges-title">
      <div className="work-exchange-panel-heading">
        <div>
          <span className="step-label">Organisation entre collègues</span>
          <h2 id="work-exchanges-title">Mes échanges</h2>
        </div>
        <strong>{exchanges.length}</strong>
      </div>
      <div className="work-exchange-list">
        {exchanges.map((exchange) => (
          <article key={exchange.id}>
            <header>
              <img src="/exchange-arrows.png" alt="" aria-hidden="true" />
              <div>
                <strong>{exchange.partnerName}</strong>
                <small className={`work-exchange-group group-${exchange.partnerGroup}`}>Groupe {exchange.partnerGroup}</small>
              </div>
              <button type="button" onClick={() => onEdit(exchange)} aria-label={`Modifier l’échange avec ${exchange.partnerName}`}>Modifier</button>
            </header>
            <ol>
              {chronologicalDetails(exchange).map((detail) => (
                <li key={detail.date} className={`exchange-${detail.role}`}>
                  <b aria-hidden="true">{detail.tag}</b>
                  <p>{detail.label}</p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
