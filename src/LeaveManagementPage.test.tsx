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
  mecenatSignups: [],
  mecenatSignupsOpen: false,
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
  onToggleMecenatSignups: vi.fn(),
  onAddMecenatSignup: vi.fn(),
  onRetainMecenatSignup: vi.fn(),
  onDeleteMecenatSignup: vi.fn(),
  onToggleArchive: vi.fn(),
  onOpenArchivedRequest: vi.fn(),
  onDeleteArchivedRequest: vi.fn(),
};

/** La rangée d'actions de la carte Mécénats, telle que rendue. */
function mecenatActionsRow(html: string) {
  const start = html.indexOf('<div class="overtime-actions mecenat-actions">');
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf("</div>", start);
  return { row: html.slice(start, end), end };
}

describe("carte Mécénats", () => {
  it("réunit les trois actions sur une rangée, les volets s’ouvrant dessous", () => {
    // Avant, « Mes dates d’inscription » et « Voir l’historique » s'empilaient
    // sous « Déclarer un mécénat » : sur Z Fold ouvert, un grand vide à droite.
    const html = renderToStaticMarkup(<LeaveManagementPage {...props} mecenatSignupsOpen />);
    const { row, end } = mecenatActionsRow(html);
    expect(row.match(/<button/g)).toHaveLength(3);
    expect(row).toContain('class="primary-action mecenat-action"');
    expect(row).toContain("Déclarer un mécénat");
    expect(row).toContain('aria-expanded="true">Masquer mes dates d’inscription');
    expect(row).toContain('aria-expanded="false">Voir l’historique');
    expect(html.indexOf('aria-label="Mes dates d’inscription"')).toBeGreaterThan(end);
  });

  it("compte les dates d’inscription sur le bouton fermé", () => {
    const signups = Array.from({ length: 2 }, () => ({})) as unknown as typeof props.mecenatSignups;
    const { row } = mecenatActionsRow(renderToStaticMarkup(<LeaveManagementPage {...props} mecenatSignups={signups} />));
    expect(row).toContain("Mes dates d’inscription (2)");
    expect(row).not.toContain("Masquer");
  });
});

describe("demandes archivées", () => {
  it("est réservée à l’administrateur, titrée et reliée à son titre", () => {
    expect(renderToStaticMarkup(<LeaveManagementPage {...props} />)).not.toContain("leave-request-archive");
    const html = renderToStaticMarkup(<LeaveManagementPage {...props} isProgramAdmin />);
    expect(html).toContain('<section class="leave-request-archive" aria-labelledby="leave-request-archive-title">');
    expect(html).toContain('<strong id="leave-request-archive-title">Demandes archivées</strong>');
  });
});

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
