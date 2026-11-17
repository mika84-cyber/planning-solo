import type { ReactNode } from "react";

/** Une rubrique de la page Congés, ouverte dans sa fenêtre. */
export type LeaveTool = "overtime" | "mecenat" | "cet";
const LEAVE_TOOLS: readonly unknown[] = ["overtime", "mecenat", "cet"];
export const isLeaveTool = (value: unknown): value is LeaveTool => LEAVE_TOOLS.includes(value);

/**
 * La fenêtre de chaque rubrique (heures, mécénats, CET) : une barre « Retour »
 * qui reste en haut, puis la rubrique. Le piège de focus, Échap et le retour
 * au bouton touché viennent de `useModalAccessibility`.
 */
export function LeaveToolWindow({ labelledBy, onClose, children }: {
  /** Le titre de la rubrique affichée, par son identifiant. */
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop leave-tool-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card leave-tool-window" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="leave-tool-window-bar">
          <button type="button" className="leave-tool-back" data-modal-close onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            Retour
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
