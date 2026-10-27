import type { CSSProperties } from "react";
import { type SelectionType, TYPE_COLORS, TYPE_LABELS } from "./planningLogic";

/**
 * Les types de congé en pastilles à la couleur du type, avec le nombre de
 * dates déjà choisies de chacun (les demi-journées comptent avec les congés
 * annuels). Le type choisi vaut pour les dates touchées ensuite : le même
 * sélecteur sert dans le panneau de la demande et juste au-dessus du
 * planning, là où l'on touche les dates — un RTT, un CA et un fractionnement
 * se posent dans la même demande sans remonter au panneau.
 */
export function LeaveTypeTabs({
  types,
  activeType,
  selectedCounts,
  labels = TYPE_LABELS,
  ariaLabel,
  onSelect,
}: {
  types: readonly SelectionType[];
  activeType: SelectionType;
  selectedCounts: Record<string, number>;
  labels?: Partial<Record<SelectionType, string>>;
  ariaLabel: string;
  onSelect: (type: SelectionType) => void;
}) {
  const countOf = (type: SelectionType) =>
    type === "annual" ? (selectedCounts.annual ?? 0) + (selectedCounts.half ?? 0) : selectedCounts[type] ?? 0;
  return (
    <div className="type-tabs" role="group" aria-label={ariaLabel}>
      {types.map((type) => (
        <button
          type="button"
          key={type}
          className={activeType === type ? "active" : ""}
          aria-pressed={activeType === type}
          style={{ "--type-color": TYPE_COLORS[type] } as CSSProperties}
          onClick={() => onSelect(type)}
        >
          <i />
          {labels[type] ?? TYPE_LABELS[type]}
          {countOf(type) ? <b>{countOf(type)}</b> : null}
        </button>
      ))}
    </div>
  );
}
