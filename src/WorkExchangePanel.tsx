import type { WorkExchange } from "./appModel";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { fromKey, longDate } from "./planningLogic";

function chronologicalDetails(exchange: WorkExchange) {
  const pronoun = colleagueObjectPronoun(exchange.partnerName);
  return [
    {
      date: exchange.returnDate,
      label: `Vous ${pronoun} remplacez le ${longDate(fromKey(exchange.returnDate))}`,
    },
    {
      date: exchange.agreementDate,
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
            <img src="/exchange-arrows.png" alt="" aria-hidden="true" />
            <div>
              <strong>{exchange.partnerName} - Groupe {exchange.partnerGroup}</strong>
              {chronologicalDetails(exchange).map((detail) => (
                <span key={detail.date}>{detail.label}</span>
              ))}
            </div>
            <button type="button" onClick={() => onEdit(exchange)}>Modifier</button>
          </article>
        ))}
      </div>
    </section>
  );
}
