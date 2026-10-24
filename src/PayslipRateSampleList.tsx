import { euros } from "./appModel";
import { useConfirm } from "./confirmDialog";
import type { NetRatioSample } from "./payslip";
import { MONTHS, s } from "./planningLogic";

/**
 * Les bulletins vérifiés qui calent les deux taux net avant impôt, du plus
 * récent au plus ancien : un bulletin mal lu s'y repère à son brut ou à son
 * net, et se retire d'un geste. Celui que l'application a écarté d'elle-même,
 * parce qu'il ne concorde pas avec les autres, le dit.
 */
export function PayslipRateSampleList({
  samples,
  onRemove,
}: {
  samples: NetRatioSample[];
  onRemove: (period: string) => void;
}) {
  const confirmAction = useConfirm();
  if (!samples.length) return null;
  const rejected = samples.filter((sample) => sample.rejected).length;
  return (
    <section className="payslip-rate-samples" aria-labelledby="payslip-rate-samples-title">
      <h4 id="payslip-rate-samples-title">Bulletins qui calent vos taux</h4>
      <p>
        {rejected
          ? `${rejected} bulletin${s(rejected)} écarté${s(rejected)} : ${rejected > 1 ? "ils ne concordent" : "il ne concorde"} pas avec les autres. `
          : ""}
        Un bulletin mal lu fausse les taux : retirez-le, ils se recalent sur les autres.
      </p>
      <ul>
        {samples.map((sample) => {
          const label = `${MONTHS[sample.month]} ${sample.year}`;
          return (
            <li key={sample.period} className={sample.rejected ? "rejected" : undefined}>
              <span>
                <b>{label[0].toUpperCase()}{label.slice(1)}</b>
                <small>
                  brut {euros(sample.gross)} · net avant impôt {euros(sample.netBeforeTax)}
                  {sample.rejected ? " · écarté" : ""}
                </small>
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  void confirmAction({
                    title: `Retirer le bulletin de ${label} ?`,
                    message: "Ses montants ne compteront plus dans vos taux, qui se recaleront sur les autres bulletins.",
                    confirmLabel: "Retirer",
                    tone: "danger",
                  }).then((ok) => { if (ok) onRemove(sample.period); });
                }}
                aria-label={`Retirer le bulletin de ${label}`}
              >
                Retirer
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
