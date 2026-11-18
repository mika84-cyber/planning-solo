import type { CSSProperties } from "react";
import type { LeavePeriod } from "./appModel";
import { HALF_MOMENT_OPTIONS, TYPE_COLORS, halfBalanceOf, periodLabel, periodTypeLabel } from "./planningLogic";

/** Ce qui est dit sous le type : journée entière, matin ou après-midi pour
 *  une absence d'un jour, ses dates sinon. */
function periodDetail(period: LeavePeriod) {
  if (period.from !== period.to) return periodLabel(period.from, period.to);
  if (period.leaveType !== "half") return "Journée entière";
  return HALF_MOMENT_OPTIONS.find((option) => option.value === period.halfMoment)?.label ?? "Demi-journée";
}

/**
 * « Déjà posé ce jour », dans la fenêtre d'une journée du planning : une ligne
 * par absence, la pastille à la couleur de son type, puis « Modifier » et la
 * corbeille qui l'annule. La date n'est pas répétée : le titre de la fenêtre
 * la donne déjà ; seules les absences de plusieurs jours disent leurs dates.
 */
export function DayLeavePeriods({ periods, onEdit, onDelete }: {
  periods: LeavePeriod[];
  onEdit: (period: LeavePeriod) => void;
  onDelete: (period: LeavePeriod) => void;
}) {
  if (!periods.length) return null;
  return (
    <div className="day-stored-periods day-leave-periods">
      <strong>Déjà posé ce jour</strong>
      {periods.map((period) => {
        const type = periodTypeLabel(period);
        const detail = periodDetail(period);
        const color = TYPE_COLORS[period.leaveType === "half" ? halfBalanceOf(period) : period.leaveType || "annual"];
        const remove = period.leaveType === "strike" ? "Supprimer la grève" : "Annuler le congé";
        return (
          <article key={period.id} style={{ "--period-color": color } as CSSProperties}>
            <i aria-hidden="true" />
            <span>
              {type}
              <small>{detail}</small>
            </span>
            <div className="period-direct-actions" role="group" aria-label={`Gérer : ${type}, ${detail}`}>
              <button className="period-edit-button" type="button" onClick={() => onEdit(period)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>
                Modifier
              </button>
              <button className="period-delete-button" type="button" aria-label={remove} title={remove} onClick={() => onDelete(period)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
