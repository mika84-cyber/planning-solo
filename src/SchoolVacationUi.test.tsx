import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SchoolVacationMonthSummary, SchoolVacationSettings } from "./SchoolVacationUi";

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
