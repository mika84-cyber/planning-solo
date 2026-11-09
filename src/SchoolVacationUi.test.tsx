import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SchoolVacationMonthSummary, SchoolVacationSettings, nextSchoolVacation, vacationShortName } from "./SchoolVacationUi";

describe("vacances scolaires dans le planning mensuel", () => {
  it("propose une activation facultative et le choix de la zone", () => {
    const html = renderToStaticMarkup(
      <SchoolVacationSettings
        visible
        zone="C"
        onVisibleChange={vi.fn()}
        onZoneChange={vi.fn()}
      />,
    );
    expect(html).toContain("Vacances scolaires");
    // Une ligne : la zone choisie à côté du nom, les autres zones repliées.
    expect(html).toContain("Zone C");
    expect(html).not.toContain("Zone A");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Vacances scolaires, Zone C : choisir la zone"');
  });

  it("annonce sous la ligne la prochaine période de la zone, ou celle en cours", () => {
    const html = renderToStaticMarkup(
      <SchoolVacationSettings
        visible={false}
        zone="C"
        onVisibleChange={vi.fn()}
        onZoneChange={vi.fn()}
        today={new Date(2026, 10, 9)}
      />,
    );
    // Même interrupteur éteint : la ligne renseigne, elle ne dépend pas de
    // l'affichage dans le planning.
    expect(html).toContain('<small class="school-vacation-next">Prochaines : Noël · ');
    expect(html).toContain("19 déc.");
    expect(html).toContain("3 janv.");
    expect(nextSchoolVacation("C", new Date(2026, 9, 20))).toEqual({
      name: "Vacances de la Toussaint", from: "2026-10-17", to: "2026-11-01", ongoing: true,
    });
    expect(nextSchoolVacation("A", new Date(2026, 10, 2))?.from).toBe("2026-12-19");
    // Passé la dernière période connue, rien.
    expect(nextSchoolVacation("A", new Date(2029, 0, 1))).toBeNull();
    expect(vacationShortName("Vacances de la Toussaint")).toBe("la Toussaint");
    expect(vacationShortName("Vacances d’été")).toBe("été");
    expect(vacationShortName("Vacances de Noël")).toBe("Noël");
  });

  it("résume uniquement les périodes du mois affiché", () => {
    const html = renderToStaticMarkup(
      <SchoolVacationMonthSummary
        zone="C"
        vacations={[{
          name: "Vacances de la Toussaint",
          from: "2026-10-17",
          to: "2026-11-01",
        }]}
      />,
    );
    expect(html).toContain("Vacances de la Toussaint");
    expect(html).toContain("Zone C");
    expect(html).toContain("17 oct.");
  });
});
