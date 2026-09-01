import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkExchangeDialog } from "./WorkExchangeDialog";

describe("WorkExchangeDialog", () => {
  it("rend les deux dates obligatoires et l’absence d’effet sur la paie", () => {
    const html = renderToStaticMarkup(
      <WorkExchangeDialog
        open
        group={2}
        draft={{
          id: "",
          partnerName: "Camille",
          partnerGroup: 1,
          agreementDate: "",
          returnDate: "",
        }}
        setDraft={vi.fn()}
        error="Les deux dates de l’échange sont obligatoires."
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(html).toContain("Journée de votre cycle · Groupe 2");
    expect(html).toContain("Journée de son cycle · Groupe 1");
    expect(html).not.toContain("Il n’y a pas d’ordre chronologique");
    expect(html).toContain("ne modifie ni la paie ni les congés");
    expect(html).toContain("Les deux dates de l’échange sont obligatoires.");
    expect(html).toContain("Choisir la journée de votre cycle");
    expect(html).toContain("Choisir la journée du cycle du collègue");
    expect(html).toContain("Vous la remplacez");
    expect(html).not.toContain("Votre cycle, groupe 2");
    expect(html).not.toContain("Cycle du collègue, groupe 1");
    expect((html.match(/type=\"date\"/g) || []).length).toBe(0);
  });
});
