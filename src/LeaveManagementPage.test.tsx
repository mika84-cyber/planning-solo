import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeaveManagementPage } from "./LeaveManagementPage";

const props = {
  balancesContent: null,
  cetContent: null,
  recoveryBalance: { earned: 600, used: 120, remaining: 480 },
  recoveryEarningsCount: 2,
  unresolvedHolidayRecoveryCount: 0,
  overtimeEntries: [],
  holidayRecoveryEarnings: [],
  recoveryUses: [],
  recoveryEarningStates: new Map(),
  overtimeHistoryOpen: false,
  mecenatEntries: [],
  mecenatHistoryOpen: false,
  isProgramAdmin: false,
  archiveOpen: false,
  archivedRequests: [],
  onOpenOvertime: vi.fn(),
  onRequestLeave: vi.fn(),
  onOpenSolidarity: vi.fn(),
  onOpenHolidayAllowances: vi.fn(),
  onToggleOvertimeHistory: vi.fn(),
  onDeleteOvertime: vi.fn(),
  onDeleteRecoveryUse: vi.fn(),
  onOpenMecenat: vi.fn(),
  onToggleMecenatHistory: vi.fn(),
  onDeleteMecenat: vi.fn(),
  onToggleArchive: vi.fn(),
  onOpenArchivedRequest: vi.fn(),
  onDeleteArchivedRequest: vi.fn(),
};

describe("alerte des crédits de férié à confirmer", () => {
  it("ne s’affiche pas quand tout est confirmé", () => {
    const html = renderToStaticMarkup(<LeaveManagementPage {...props} />);
    expect(html).not.toContain("alert-fix-action");
  });

  it("devient le chemin vers l’écran où corriger, et non une simple phrase", () => {
    // Avant, l'alerte nommait « Ma paie > Primes et jours fériés » et laissait
    // chercher : elle conduit désormais directement à cet écran.
    const html = renderToStaticMarkup(
      <LeaveManagementPage {...props} unresolvedHolidayRecoveryCount={4} />,
    );
    expect(html).toContain('class="allowance-note warn alert-fix-action"');
    expect(html).toContain("4 anciens crédits de férié restent à confirmer");
    expect(html).toContain("Confirmer dans Ma paie");
  });

  it("accorde le libellé au singulier", () => {
    const html = renderToStaticMarkup(
      <LeaveManagementPage {...props} unresolvedHolidayRecoveryCount={1} />,
    );
    expect(html).toContain("1 ancien crédit de férié reste à confirmer");
  });
});
