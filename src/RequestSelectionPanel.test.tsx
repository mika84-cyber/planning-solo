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
  it("propose CA, RTT et fractionnement, puis leur durée : journée entière, matin ou après-midi", () => {
    const html = renderToStaticMarkup(
      <RequestSelectionPanel {...baseProps} activeType="rtt" leaveMoment="morning" onSelectLeaveMoment={vi.fn()} />,
    );
    // Plus de type « Congés en demi-journée » à part.
    expect(html).not.toContain("Congés en demi-journée");
    expect(html).toContain('role="group" aria-label="Durée du congé"');
    expect(html).toMatch(/aria-pressed="false">Journée<\/button><button type="button" class="active" aria-pressed="true">Matin<\/button>/);
    expect(html).toContain(">Après-midi</button>");
  });

  it("ne propose pas de durée pour les autres congés", () => {
    const html = renderToStaticMarkup(
      <RequestSelectionPanel {...baseProps} activeType="cet" leaveMoment="full" onSelectLeaveMoment={vi.fn()} />,
    );
    expect(html).not.toContain("Durée du congé");
  });
});
