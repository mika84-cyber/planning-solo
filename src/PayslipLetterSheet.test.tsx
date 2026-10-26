import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayslipLetterSheet } from "./PayslipLetterSheet";
import type { PayslipGapRecord } from "./payslipVerificationRecords";

const gap: PayslipGapRecord = {
  level: "net",
  expected: { gross: 2822.48, netBeforeTax: 2277.19, incomeTax: 52.95, net: 2224.24 },
  actual: { gross: 2795.02, netBeforeTax: 2252.55, incomeTax: 52.38, net: 2200.17 },
  gap: -24.07,
  lines: [{ key: "sundays", title: "Un demi-dimanche non payé", detail: "", amount: -27.46, kind: "cause", found: 6.5, expected: 7 }],
};

describe("PayslipLetterSheet", () => {
  it("montre le courrier tel qu’il partira, prêt à télécharger ou envoyer", () => {
    const html = renderToStaticMarkup(
      <PayslipLetterSheet gap={gap} year={2026} month={9} fullName="Camille Exemple" today={new Date("2026-11-03T10:00:00")} onSave={vi.fn()} onClose={vi.fn()} />,
    ).replace(/[  ]/g, " ");
    expect(html).toContain('aria-label="Écrire à ma hiérarchie"');
    expect(html).toContain('value="Service des ressources humaines"');
    expect(html).toContain("Un mot de votre part (facultatif)");
    // Le nom est connu : pas de champ pour le saisir.
    expect(html).not.toContain("Votre nom, pour signer");
    expect(html).toContain("Paris, le 3 novembre 2026");
    expect(html).toContain("Objet : écart sur mon bulletin de paie d’octobre 2026");
    expect(html).toContain("<th scope=\"row\">Dimanches au-delà du 10e</th><td>7 · 384,51 €</td><td>6,5 · 357,05 €</td>");
    expect(html).toContain("Camille Exemple");
    expect(html).toContain("Télécharger le PDF");
    expect(html).toContain(">Modifier le texte</button>");
    expect(html).not.toContain("Revenir au texte proposé");
    expect(html).toContain("Envoyer par e-mail");
  });

  it("montre le texte réécrit, et propose d’y revenir", () => {
    const html = renderToStaticMarkup(
      <PayslipLetterSheet gap={gap} year={2026} month={9} fullName="Camille Exemple" subject="Objet : demi-dimanche" body={"Madame,\n\nIl me manque un demi-dimanche."} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    expect(html).toContain('<p class="subject">Objet : demi-dimanche</p><p>Madame,</p><p>Il me manque un demi-dimanche.</p>');
    expect(html).toContain("Revenir au texte proposé");
    // Le texte réécrit remplace le mot facultatif.
    expect(html).not.toContain("Un mot de votre part");
    // Le détail de l'écart, sous la signature.
    expect(html.indexOf("Détail de l’écart")).toBeGreaterThan(html.indexOf('class="sign"'));
  });

  it("demande le nom quand le profil ne le connaît pas", () => {
    const html = renderToStaticMarkup(<PayslipLetterSheet gap={gap} year={2026} month={9} fullName="" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("Votre nom, pour signer");
  });
});
