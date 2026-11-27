import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LeaveRequestWindow } from "./LeaveRequestWindow";

describe("LeaveRequestWindow", () => {
  it("reste sans rendu serveur quand document est absent (portail client)", () => {
    const html = renderToStaticMarkup(
      <LeaveRequestWindow
        requestKind="leave"
        sickRequest={false}
        activeType="annual"
        leaveMoment="full"
        leaveHours={{ start: "", end: "" }}
        view={new Date(2026, 11, 1)}
        now={new Date(2026, 10, 26)}
        group={2}
        workQuota="full"
        selectedList={[
          { date: "2026-12-03", type: "annual" },
          { date: "2026-12-04", type: "annual" },
        ]}
        leaveRemainingByType={{ annual: 29, rtt: 15, fraction: 2 }}
        cetRemaining={0}
        recoveryBalanceRemaining={120}
        savingRequest={false}
        selectionBlocked={false}
        calendarSlide=""
        onStepMonth={vi.fn()}
        onSelectMonth={vi.fn()}
        onToday={vi.fn()}
        onTouchStart={vi.fn()}
        onTouchEnd={vi.fn()}
        onSelectDay={vi.fn()}
        onSelectLeaveType={vi.fn()}
        onSelectLeaveMoment={vi.fn()}
        onSelectLeaveHours={vi.fn()}
        onSelectRecoveryType={vi.fn()}
        onSwitchRequest={vi.fn()}
        onRemoveDate={vi.fn()}
        onClearDates={vi.fn()}
        onValidateAndOpenForm={vi.fn()}
        onSaveToPlanning={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });
});
