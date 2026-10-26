import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RequestSelectionPanel } from "./RequestSelectionPanel";

const baseProps = {
  requestKind: "leave" as const,
  sickRequest: false,
  setActiveType: vi.fn(),
  selectedList: [],
  selectedCounts: {},
  group: 2,
  workQuota: 100 as never,
  recoveryBalanceRemaining: 0,
  leaveRemainingByType: {},
  savingRequest: false,
  selectionBlocked: false,
  onCancel: vi.fn(),
  onSelectLeaveType: vi.fn(),
  onSelectRecoveryType: vi.fn(),
  onValidateAndOpenForm: vi.fn(),
  onSaveToPlanning: vi.fn(),
};

describe("panneau de la demande", () => {
  it("propose aux congés annuels la journée entière, le matin ou l’après-midi, aux heures choisies", () => {
    const html = renderToStaticMarkup(
      <RequestSelectionPanel {...baseProps} activeType="annual" leaveMoment="morning" onSelectLeaveMoment={vi.fn()} leaveHours={{ start: "09:15", end: "13:30" }} onChangeLeaveHours={vi.fn()} />,
    );
    // Plus de type « Congés en demi-journée » à part ; l'explication tient
    // en une ligne, pour que la durée reste à portée de main.
    expect(html).not.toContain("Congés en demi-journée");
    expect(html).toContain("Touchez les dates dans le planning. Vous pouvez changer de type entre deux dates");
    expect(html).not.toContain("Vous pouvez mélanger plusieurs types");
    expect(html).toContain('role="group" aria-label="Durée du congé"');
    expect(html).toMatch(/aria-pressed="false">Journée<\/button><button type="button" class="active" aria-pressed="true">Matin<\/button>/);
    expect(html).toContain(">Après-midi</button>");
    // Le matin : les heures posées, modifiables.
    expect(html).toContain('role="group" aria-label="Heures posées le matin"');
    expect(html).toMatch(/aria-label="Début — heures"[^>]*>[\s\S]*?<option value="9" selected="">9 h<\/option>/);
    expect(html).toContain("Fin");
    expect(html).not.toContain("L’heure de fin doit suivre");
    // Une fin avant le début est signalée.
    const reversed = renderToStaticMarkup(
      <RequestSelectionPanel {...baseProps} activeType="annual" leaveMoment="afternoon" onSelectLeaveMoment={vi.fn()} leaveHours={{ start: "17:00", end: "14:00" }} onChangeLeaveHours={vi.fn()} />,
    );
    expect(reversed).toContain('aria-label="Heures posées l’après-midi"');
    expect(reversed).toContain("L’heure de fin doit suivre l’heure de début.");
    // En journée entière, pas d'heures.
    const full = renderToStaticMarkup(
      <RequestSelectionPanel {...baseProps} activeType="annual" leaveMoment="full" onSelectLeaveMoment={vi.fn()} onChangeLeaveHours={vi.fn()} />,
    );
    expect(full).not.toContain("Heures posées");
  });

  it("pose les RTT et le fractionnement en journée entière seulement", () => {
    for (const activeType of ["rtt", "fraction"] as const) {
      const html = renderToStaticMarkup(
        <RequestSelectionPanel {...baseProps} activeType={activeType} leaveMoment="morning" onSelectLeaveMoment={vi.fn()} onChangeLeaveHours={vi.fn()} />,
      );
      expect(html).not.toContain("Durée du congé");
      expect(html).not.toContain("Heures posées");
    }
  });

  it("ne propose pas de durée pour les autres congés", () => {
    const html = renderToStaticMarkup(
      <RequestSelectionPanel {...baseProps} activeType="cet" leaveMoment="full" onSelectLeaveMoment={vi.fn()} />,
    );
    expect(html).not.toContain("Durée du congé");
  });
});
