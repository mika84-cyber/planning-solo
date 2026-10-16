import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkExchangeDialog } from "./WorkExchangeDialog";

describe("WorkExchangeDialog", () => {
  it("présente la feuille à signer puis trois étapes : votre journée, votre collègue, sa journée", () => {
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
          agreementStart: "",
          agreementEnd: "",
          returnStart: "10:00",
          returnEnd: "18:00",
        }}
        setDraft={vi.fn()}
        error="Les deux dates de l’échange sont obligatoires."
        saving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(html).toContain("Faire un échange");
    // Deux onglets, la même structure.
    expect(html).toContain(">Journée<");
    expect(html).toContain(">Jour férié<");
    // Une journée : pas d'encadré, la demande d'échange va de soi.
    expect(html).not.toContain("xch-sheet");
    expect(html).toContain("Votre journée");
    expect(html).toContain("Groupe 2 · Camille vous remplace");
    expect(html).toContain("Votre collègue");
    expect(html).toContain("Sa journée");
    expect(html).toContain("Groupe 1 · Vous remplacez Camille");
    // Sa journée attend la vôtre.
    expect(html).toContain("Choisissez d’abord votre journée.");
    expect(html).toContain("Les deux dates de l’échange sont obligatoires.");
    expect(html).toContain("Choisir la journée de votre cycle");
    expect((html.match(/type="date"/g) || []).length).toBe(0);
    expect(html).toContain('aria-label="Horaires de la journée de votre cycle"');
    expect(html).toContain('aria-label="Horaires de la journée de son cycle"');
    expect(html).toContain("Valider l’échange");
  });

  it("déduit de votre journée le groupe du collègue, seul choix possible", async () => {
    const { getDayInfo, dateKey } = await import("./planningLogic");
    const day = Array.from({ length: 31 }, (_, index) => new Date(2026, 11, index + 1, 12))
      .find((date) => getDayInfo(date, 2).kind === "work" && !getDayInfo(date, 2).holiday
        && [1, 3].filter((other) => getDayInfo(date, other).kind === "off").length === 1)!;
    const offGroup = [1, 3].find((other) => getDayInfo(day, other).kind === "off")!;
    const html = renderToStaticMarkup(
      <WorkExchangeDialog open group={2}
        draft={{ id: "", partnerName: "", partnerGroup: offGroup, agreementDate: dateKey(day), returnDate: "", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "" }}
        setDraft={vi.fn()} error="" saving={false} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(html).toContain(`En repos ce jour-là : groupe ${offGroup}`);
    const other = offGroup === 1 ? 3 : 1;
    expect(html).toMatch(new RegExp(`aria-checked="false" disabled="" class="group-${other}"`));
  });
});
