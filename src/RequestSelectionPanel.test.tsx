import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeaveDurationControl } from "./LeaveDurationControl";
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
  onSelectRecoveryType: vi.fn(),
  onValidateAndOpenForm: vi.fn(),
  onSaveToPlanning: vi.fn(),
};

describe("panneau de la demande", () => {
  it("laisse le type et la durée au bloc du planning, et ne garde qu’un « Annuler la demande »", () => {
    const html = renderToStaticMarkup(<RequestSelectionPanel {...baseProps} activeType="annual" />);
    // CA, RTT, fractionnement et la durée se choisissent au-dessus du
    // planning : le panneau ne les répète plus (jusqu'au 12 novembre 2026).
    expect(html).not.toContain("Choix courants");
    expect(html).not.toContain("Durée du congé");
    expect(html).toContain("Choisissez le congé et sa durée juste au-dessus du planning, puis touchez les dates.");
    // Les types plus rares restent dans le panneau.
    expect(html).toContain("<strong>Autres types de congé</strong>");
    // Plus de bouton « Annuler » en tête : le seul abandon est le lien du bas.
    expect(html).not.toContain('class="text-button danger"');
    expect(html.match(/Annuler la demande/g)).toHaveLength(1);
    expect(html).toContain('<button class="request-cancel-link" type="button">Annuler la demande</button>');
  });

  it("garde « Fermer » en tête pour la grève, qui n’a pas de relecture", () => {
    const html = renderToStaticMarkup(<RequestSelectionPanel {...baseProps} requestKind="strike" activeType="strike" />);
    expect(html).toContain('<button class="text-button danger" type="button" aria-label="Fermer">Fermer</button>');
    expect(html).not.toContain("request-cancel-link");
  });

  it("ne garde aussi qu’un abandon pour un arrêt maladie, des dates Divers ou une récupération", () => {
    for (const props of [
      { requestKind: "leave" as const, sickRequest: true, activeType: "sick" as const },
      { requestKind: "other" as const, activeType: "other" as const },
      { requestKind: "recovery" as const, activeType: "recovery_day" as const },
    ]) {
      const html = renderToStaticMarkup(<RequestSelectionPanel {...baseProps} {...props} />);
      expect(html).not.toContain('class="text-button danger"');
      expect(html.match(/Annuler la demande/g)).toHaveLength(1);
    }
  });
});

describe("durée des dates touchées", () => {
  it("propose la journée entière, le matin ou l’après-midi, aux heures choisies", () => {
    const morning = renderToStaticMarkup(
      <LeaveDurationControl moment="morning" hours={{ start: "09:15", end: "13:30" }} color="#000" ariaLabel="Durée des dates touchées" onSelectMoment={vi.fn()} onChangeHours={vi.fn()} />,
    );
    expect(morning).toContain('role="group" aria-label="Durée des dates touchées"');
    expect(morning).toMatch(/aria-pressed="false">Journée<\/button><button type="button" class="active" aria-pressed="true">Matin<\/button>/);
    expect(morning).toContain(">Après-midi</button>");
    // Le matin : les heures posées, modifiables.
    expect(morning).toContain('role="group" aria-label="Heures posées le matin"');
    expect(morning).toMatch(/aria-label="Début — heures"[^>]*>[\s\S]*?<option value="9" selected="">9 h<\/option>/);
    expect(morning).not.toContain("L’heure de fin doit suivre");
    // Une fin avant le début est signalée.
    const reversed = renderToStaticMarkup(
      <LeaveDurationControl moment="afternoon" hours={{ start: "17:00", end: "14:00" }} color="#000" onSelectMoment={vi.fn()} onChangeHours={vi.fn()} />,
    );
    expect(reversed).toContain('aria-label="Heures posées l’après-midi"');
    expect(reversed).toContain("L’heure de fin doit suivre l’heure de début.");
    // En journée entière, pas d'heures.
    const full = renderToStaticMarkup(
      <LeaveDurationControl moment="full" hours={{ start: "", end: "" }} color="#000" onSelectMoment={vi.fn()} onChangeHours={vi.fn()} />,
    );
    expect(full).not.toContain("Heures posées");
  });
});
