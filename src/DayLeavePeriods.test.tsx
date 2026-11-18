import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LeavePeriod } from "./appModel";
import { DayLeavePeriods } from "./DayLeavePeriods";

const period = (extra: Partial<LeavePeriod>): LeavePeriod => ({ id: "p1", from: "2026-11-04", to: "2026-11-04", leaveType: "rtt", updatedAt: "2026-11-01T10:00:00.000Z", ...extra });
const render = (periods: LeavePeriod[]) => renderToStaticMarkup(<DayLeavePeriods periods={periods} onEdit={vi.fn()} onDelete={vi.fn()} />);

describe("absences déjà posées dans la fenêtre d'une journée", () => {
  it("tient sur une ligne : la pastille à la couleur du type, le type, la durée, puis les actions", () => {
    // Avant : la date du jour répétée, un trait bleu pour tous les types et
    // deux grands boutons empilés (contrôle textuel dans uiRefinement.test.mjs).
    const html = render([period({})]);
    expect(html).toContain('<div class="day-stored-periods day-leave-periods"><strong>Déjà posé ce jour</strong>');
    expect(html).toContain('<article style="--period-color:#72b7ad"><i aria-hidden="true"></i><span>RTT<small>Journée entière</small></span>');
    expect(html).toContain('<div class="period-direct-actions" role="group" aria-label="Gérer : RTT, Journée entière"><button class="period-edit-button" type="button"><svg');
    expect(html).toContain("</svg>Modifier</button>");
    // La corbeille porte son nom : lecteurs d'écran et info-bulle.
    expect(html).toContain('<button class="period-delete-button" type="button" aria-label="Annuler le congé" title="Annuler le congé"><svg');
    expect(html).not.toContain("04/11/2026");
    expect(html).not.toContain("Repasser en souhaité");
    expect(html).not.toContain("period-menu-trigger");
  });

  it("dit le moment d'une demi-journée et les dates d'une absence de plusieurs jours", () => {
    const half = render([period({ leaveType: "half", halfBalance: "fraction", halfMoment: "afternoon" })]);
    expect(half).toContain('<article style="--period-color:#c9a6ea"><i aria-hidden="true"></i><span>Fractionnement en demi-journée<small>Après-midi</small></span>');
    const week = render([period({ leaveType: "annual", from: "2026-11-02", to: "2026-11-06" })]);
    expect(week).toContain("<span>Congés annuels<small>Du 02/11/2026 au 06/11/2026</small></span>");
    expect(week).toContain('aria-label="Gérer : Congés annuels, Du 02/11/2026 au 06/11/2026"');
  });

  it("nomme la suppression d'une grève, et ne montre rien sans absence", () => {
    expect(render([period({ leaveType: "strike" })])).toContain('aria-label="Supprimer la grève" title="Supprimer la grève"');
    expect(render([])).toBe("");
  });
});
