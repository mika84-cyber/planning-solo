import type { RequestKind, SelectedDay } from "./appModel";
import { TYPE_LABELS, fromKey, longDate, s } from "./planningLogic";

function impactLabel(kind: RequestKind, sickRequest: boolean) {
  if (kind === "other") return "Repère visible uniquement dans le planning, sans effet sur la paie ni les soldes.";
  if (kind === "strike") return "Jour non travaillé, sans effet sur les soldes, avec retenue brute estimée au trentième.";
  if (sickRequest) return "Ajouté au suivi des arrêts maladie, sans diminuer les droits à congés.";
  if (kind === "recovery") return "Déduit du solde d’heures de récupération selon la durée choisie.";
  return "Déduit du solde correspondant après enregistrement de la demande.";
}

export function RequestValidationSummary({
  items,
  requestKind,
  sickRequest,
}: {
  items: SelectedDay[];
  requestKind: RequestKind;
  sickRequest: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="request-validation-summary" aria-label="Résumé avant validation">
      <header>
        <span>Résumé avant validation</span>
        <strong>
          {items.length} date{s(items.length)}
        </strong>
      </header>
      <div className="request-validation-dates">
        {items.map((item) => (
          <article key={item.date}>
            <span>
              <strong>{longDate(fromKey(item.date))}</strong>
              <small>{TYPE_LABELS[item.type]}</small>
            </span>
            {item.start || item.end ? (
              <em>
                {item.start || "—"} → {item.end || "—"}
              </em>
            ) : null}
          </article>
        ))}
      </div>
      <p>
        <strong>Effet de la validation</strong>
        <span>{impactLabel(requestKind, sickRequest)}</span>
      </p>
    </section>
  );
}
