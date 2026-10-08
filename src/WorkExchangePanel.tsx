import type { WorkExchange } from "./appModel";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { fromKey, getDayInfo, longDate } from "./planningLogic";

/** « : Jour de l’an · jeudi 1 janvier 2026 » pour un férié, « le mardi
 *  15 septembre 2026 » sinon. */
function dayLabel(key: string) {
  const date = fromKey(key);
  const holiday = getDayInfo(date, 1).holiday;
  return holiday ? `: ${holiday} · ${longDate(date)}` : `le ${longDate(date)}`;
}

/** Les deux journées de l'échange, dans l'ordre du calendrier : chacune dit
 *  ce qu'elle devient pour vous (repos ou travail) et qui remplace qui. */
function chronologicalDetails(exchange: WorkExchange) {
  const pronoun = colleagueObjectPronoun(exchange.partnerName);
  return [
    {
      date: exchange.returnDate,
      role: "return" as const,
      tag: "Travail",
      label: `Vous ${pronoun} remplacez ${dayLabel(exchange.returnDate)}`,
    },
    {
      date: exchange.agreementDate,
      role: "given" as const,
      tag: "Off",
      label: `${exchange.partnerName} vous remplace ${dayLabel(exchange.agreementDate)}`,
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
        {exchanges.map((exchange) => {
          // Un échange de fériés : les flèches entourent un dollar.
          const holidayExchange = Boolean(getDayInfo(fromKey(exchange.agreementDate), 1).holiday);
          return (
          <article key={exchange.id} className={holidayExchange ? "holiday-exchange" : undefined}>
            <header>
              <img src={holidayExchange ? "/holiday-exchange.png" : "/exchange-arrows.png"} alt="" aria-hidden="true" />
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
          );
        })}
      </div>
    </section>
  );
}
