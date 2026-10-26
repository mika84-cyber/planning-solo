import { describe, expect, it } from "vitest";
import { letterParagraphs, payslipLetter, payslipLetterPdfName } from "./payslipGapLetter";
import type { PayslipGapRecord } from "./payslipVerificationRecords";

const plain = (text: string) => text.replace(/[  ]/g, " ");

const gap: PayslipGapRecord = {
  level: "net",
  expected: { gross: 2822.48, netBeforeTax: 2277.19, incomeTax: 52.95, net: 2224.24 },
  actual: { gross: 2795.02, netBeforeTax: 2252.55, incomeTax: 52.38, net: 2200.17 },
  gap: -24.07,
  lines: [
    { key: "sundays", title: "Un demi-dimanche non payé", detail: "", amount: -27.46, kind: "cause", found: 6.5, expected: 7 },
    { key: "contributions", title: "Moins de cotisations", detail: "", amount: 2.82, kind: "follow" },
    { key: "income-tax", title: "Moins d’impôt", detail: "", amount: 0.57, kind: "follow" },
  ],
};

describe("payslipLetter", () => {
  it("rédige le courrier : l’écart du net, sa cause, le tableau et la demande", () => {
    const letter = payslipLetter({
      gap, year: 2026, month: 9, date: new Date("2026-11-03T10:00:00"),
      recipient: "", message: "Merci de votre aide.", fullName: "Camille Exemple",
    });
    expect(letter.place).toBe("Paris, le 3 novembre 2026");
    expect(letter.recipient).toBe("Service des ressources humaines");
    expect(letter.subject).toBe("Objet : écart sur mon bulletin de paie d’octobre 2026");
    expect(letterParagraphs(letter.body).map(plain)).toEqual([
      "Madame, Monsieur,",
      "Mon bulletin de paie d’octobre 2026 m’a versé 2 200,17 € net, alors que 2 224,24 € étaient attendus, soit un écart de 24,07 €.",
      "L’indemnité de travail dominical porte 6,5 dimanches, alors que 7 dimanches étaient dus : il manque un demi-dimanche, soit 27,46 € brut.",
      "Merci de votre aide.",
      "Je vous remercie de bien vouloir vérifier ce point et procéder à la régularisation sur une prochaine paie.",
      "Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.",
    ]);
    expect(letter.table.map((row) => ({ ...row, expected: plain(row.expected), found: plain(row.found) }))).toEqual([
      { label: "Dimanches au-delà du 10e", expected: "7 · 384,51 €", found: "6,5 · 357,05 €" },
      { label: "Brut", expected: "2 822,48 €", found: "2 795,02 €" },
      { label: "Net avant impôt", expected: "2 277,19 €", found: "2 252,55 €" },
      { label: "Net à payer", expected: "2 224,24 €", found: "2 200,17 €" },
    ]);
    expect(letter.signature).toBe("Camille Exemple");
  });

  it("dit un écart sans ligne en cause, sans l’inventer", () => {
    const letter = payslipLetter({
      gap: { ...gap, lines: [{ key: "gross-other", title: "Brut plus bas", detail: "", amount: -20, kind: "unknown" }] },
      year: 2026, month: 2, date: new Date("2026-04-02T10:00:00"), recipient: "Mme Martin", message: "", fullName: "",
    });
    expect(letter.subject).toBe("Objet : écart sur mon bulletin de paie de mars 2026");
    expect(plain(letterParagraphs(letter.body)[2])).toBe("Une différence de 20,00 € sur le brut ne correspond à aucune ligne que j’aie pu identifier.");
    expect(letter.recipient).toBe("Mme Martin");
  });

  it("cite le texte d’une somme due, et ne réclame ni l’impôt ni des taux recalés", () => {
    const letter = payslipLetter({
      gap: { ...gap, lines: [
        { key: "mecenat", title: "Mécénats : 30,25 € de moins que prévu", detail: "7 h 30 payées au taux de jour (22,90 €) : la majoration de nuit de 2 h 30 manque", amount: -30.25, kind: "cause", found: 171.75, expected: 202, reference: "article 2 de l’arrêté du 18 mai 2010, modifié par l’arrêté du 15 décembre 2023, fixe un taux majoré de 35,00 € par heure effectuée de 22 heures à 7 heures du matin" },
        { key: "contributions-other", title: "Cotisations plus élevées que prévu", detail: "", amount: -43.29, kind: "cause", applied: "taux de cotisations recalés sur ce bulletin" },
        { key: "pas-rate", title: "Taux d’imposition de 2,6 % au lieu de 2,2 %", detail: "", amount: -9.63, kind: "cause", found: 2.6, expected: 2.2 },
      ] },
      year: 2026, month: 9, date: new Date("2026-11-03T10:00:00"), recipient: "", message: "", fullName: "",
    });
    expect(letterParagraphs(letter.body).slice(1, 3).map(plain)).toEqual([
      "Mon bulletin de paie d’octobre 2026 m’a versé 2 200,17 € net, alors que 2 224,24 € étaient attendus, soit un écart de 24,07 €.",
      "Mécénats : 171,75 € versés, 202,00 € attendus — 7 h 30 payées au taux de jour (22,90 €) : la majoration de nuit de 2 h 30 manque. Or l’article 2 de l’arrêté du 18 mai 2010, modifié par l’arrêté du 15 décembre 2023, fixe un taux majoré de 35,00 € par heure effectuée de 22 heures à 7 heures du matin.",
    ]);
    expect(letter.table.map((row) => row.label)).toEqual(["Mécénats", "Brut", "Net avant impôt", "Net à payer"]);
  });

  it("garde l’objet et le texte que la personne a réécrits", () => {
    const letter = payslipLetter({
      gap, year: 2026, month: 9, date: new Date("2026-11-03T10:00:00"),
      recipient: "", message: "Ce mot n’y est plus.", fullName: "",
      subject: "Objet : demi-dimanche d’octobre", body: "Madame,\n\nIl me manque un demi-dimanche.\n\n\nCordialement.",
    });
    expect(letter.subject).toBe("Objet : demi-dimanche d’octobre");
    expect(letterParagraphs(letter.body)).toEqual(["Madame,", "Il me manque un demi-dimanche.", "Cordialement."]);
    // Le détail de l'écart reste, sous la signature.
    expect(letter.table.map((row) => row.label)).toContain("Net à payer");
    // Vides, l'objet et le texte proposés reviennent.
    expect(payslipLetter({ gap, year: 2026, month: 9, date: new Date(), recipient: "", message: "", fullName: "", subject: " ", body: "" }).subject)
      .toBe("Objet : écart sur mon bulletin de paie d’octobre 2026");
  });

  it("nomme le PDF d’après le mois du bulletin", () => {
    expect(payslipLetterPdfName(2026, 9)).toBe("courrier-bulletin-2026-10.pdf");
  });
});
