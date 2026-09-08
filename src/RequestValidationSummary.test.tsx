import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestValidationSummary, zeroLeaveBalanceType } from "./RequestValidationSummary";

describe("résumé avant validation", () => {
  it("reste absent tant qu’aucune date n’est sélectionnée", () => {
    expect(
      renderToStaticMarkup(
        <RequestValidationSummary
          items={[]}
          requestKind="leave"
          sickRequest={false}
        />,
      ),
    ).toBe("");
  });

  it("récapitule les dates, les types, les horaires et l’impact", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[
          { date: "2026-08-11", type: "annual" },
          {
            date: "2026-08-12",
            type: "recovery_hours",
            start: "09:00",
            end: "11:00",
          },
        ]}
        requestKind="recovery"
        sickRequest={false}
        recoveryBalanceRemaining={495}
      />,
    );

    expect(html).toContain("Résumé avant validation");
    expect(html).toContain("2 dates");
    expect(html).toContain("mardi 11 août 2026");
    expect(html).toContain("09:00");
    expect(html).toContain("11:00");
    expect(html).toContain("Déduit du solde d’heures de récupération");
    expect(html).toContain("2 h déduites");
    expect(html).toContain("8 h 15 → 6 h 15");
  });

  it("explique naturellement un solde de récupération nul ou insuffisant", () => {
    const noBalance = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-11", type: "recovery_hours", start: "09:00", end: "13:00" }]}
        requestKind="recovery"
        sickRequest={false}
        recoveryBalanceRemaining={0}
      />,
    );
    expect(noBalance).toContain("Vous n’avez plus d’heures de récupération disponibles.");
    expect(noBalance).not.toContain("0 min → 0 min");

    const insufficient = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-11", type: "recovery_hours", start: "09:00", end: "13:00" }]}
        requestKind="recovery"
        sickRequest={false}
        recoveryBalanceRemaining={120}
      />,
    );
    expect(insufficient).toContain("Il ne vous reste que 2 h de récupération disponibles. Vous avez sélectionné 4 h.");
  });

  it("conserve le solde avant et après lorsqu’une récupération est exactement couverte", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-11", type: "recovery_hours", start: "09:00", end: "13:00" }]}
        requestKind="recovery"
        sickRequest={false}
        recoveryBalanceRemaining={240}
      />,
    );
    expect(html).toContain("Solde disponible : 4 h → 0 h");
    expect(html).not.toContain("request-validation-warning");
  });

  it("montre le décompte et le solde avant de poursuivre", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-11", type: "annual" }]}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ annual: 5 }}
      />,
    );
    expect(html).toContain("1 date sélectionnée");
    expect(html).toContain("4 CA restants");
  });

  it("met en avant le disponible lorsque les CA ou RTT sont dépassés", () => {
    const dates = ["2026-08-11", "2026-08-12"];
    const annual = renderToStaticMarkup(
      <RequestValidationSummary
        items={dates.map((date) => ({ date, type: "annual" as const }))}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ annual: 1 }}
      />,
    );
    expect(annual).toContain("Il ne vous reste qu’un jour de congé annuel disponible. Vous en avez sélectionné 2.");
    expect(annual).not.toContain("1 → 0");

    const rtt = renderToStaticMarkup(
      <RequestValidationSummary
        items={dates.map((date) => ({ date, type: "rtt" as const }))}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ rtt: 1 }}
      />,
    );
    expect(rtt).toContain("Il ne vous reste qu’un jour de RTT disponible. Vous en avez sélectionné 2.");
  });

  it("adapte les alertes aux soldes nuls, aux demi-journées et au fractionnement", () => {
    const noAnnual = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-11", type: "annual" }]}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ annual: 0 }}
      />,
    );
    expect(noAnnual).toContain("Vous n’avez plus de congés annuels disponibles.");

    const halfDay = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-11", type: "half" }]}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ annual: 0.25 }}
      />,
    );
    expect(halfDay).toContain("Vous en avez sélectionné une demi-journée.");

    const noFraction = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-11", type: "fraction" }]}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ fraction: 0 }}
      />,
    );
    expect(noFraction).toContain("Vous n’avez plus de jours de fractionnement disponibles.");
  });

  it("identifie les validations à bloquer lorsque le solde utile est nul", () => {
    expect(zeroLeaveBalanceType(
      [{ date: "2026-08-11", type: "annual" }],
      2,
      { annual: 0 },
    )).toBe("annual");
    expect(zeroLeaveBalanceType(
      [{ date: "2026-08-11", type: "half" }],
      2,
      { annual: 0 },
    )).toBe("annual");
    expect(zeroLeaveBalanceType(
      [{ date: "2026-08-11", type: "rtt" }],
      2,
      { rtt: 0 },
    )).toBe("rtt");
    expect(zeroLeaveBalanceType(
      [{ date: "2026-08-11", type: "fraction" }],
      2,
      { fraction: 0 },
    )).toBe("fraction");
    expect(zeroLeaveBalanceType(
      [{ date: "2026-08-09", type: "annual" }],
      2,
      { annual: 0 },
    )).toBeUndefined();
  });

  it("détaille séparément une sélection mixte CA et RTT", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[
          { date: "2026-08-11", type: "annual" },
          { date: "2026-08-12", type: "rtt" },
        ]}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ annual: 5, rtt: 3 }}
      />,
    );
    expect(html).toContain("4 CA restants");
    expect(html).toContain("2 RTT restants");
  });

  it("conserve dans le détail une catégorie sélectionnée mais non décomptée", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-09", type: "annual" }]}
        requestKind="leave"
        sickRequest={false}
        group={2}
        leaveRemaining={{ annual: 5 }}
      />,
    );
    expect(html).toContain("5 CA restants");
    expect(html).toContain("1 jour de repos ou férié non décompté.");
  });

  it("explique que Divers ne modifie ni la paie ni les soldes", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-13", type: "other" }]}
        requestKind="other"
        sickRequest={false}
      />,
    );

    expect(html).toContain("Repère visible uniquement dans le planning");
    expect(html).toContain("sans effet sur la paie ni les soldes");
  });

  it("explique la retenue de grève sans déduction de congé", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-13", type: "strike" }]}
        requestKind="strike"
        sickRequest={false}
      />,
    );
    expect(html).toContain("retenue brute estimée au trentième");
    expect(html).toContain("sans effet sur les soldes");
  });

  it("prévient que la maladie recrédite les congés déjà posés", () => {
    const html = renderToStaticMarkup(
      <RequestValidationSummary
        items={[{ date: "2026-08-13", type: "sick" }]}
        requestKind="leave"
        sickRequest
      />,
    );
    expect(html).toContain("Seuls les congés annuels");
    expect(html).toContain("autres congés resteront annulables manuellement");
  });
});
