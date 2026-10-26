import { describe, expect, it } from "vitest";
import { payslipLetter, payslipLetterPdfName } from "./payslipGapLetter";
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
    expect(letter.paragraphs.map(plain)).toEqual([
      "Mon bulletin de paie d’octobre 2026 m’a versé 2 200,17 € net, alors que 2 224,24 € étaient attendus, soit un écart de 24,07 €.",
      "L’indemnité de travail dominical porte 6,5 dimanches, alors que 7 dimanches étaient dus : il manque un demi-dimanche, soit 27,46 € brut.",
      "Merci de votre aide.",
    ]);
    expect(letter.table.map((row) => ({ ...row, expected: plain(row.expected), found: plain(row.found) }))).toEqual([
      { label: "Dimanches au-delà du 10e", expected: "7 · 384,51 €", found: "6,5 · 357,05 €" },
      { label: "Brut", expected: "2 822,48 €", found: "2 795,02 €" },
      { label: "Net avant impôt", expected: "2 277,19 €", found: "2 252,55 €" },
      { label: "Net à payer", expected: "2 224,24 €", found: "2 200,17 €" },
    ]);
    expect(letter.request).toBe("Je vous remercie de bien vouloir vérifier ce point et procéder à la régularisation sur une prochaine paie.");
    expect(letter.signature).toBe("Camille Exemple");
  });

  it("dit un écart sans ligne en cause, sans l’inventer", () => {
    const letter = payslipLetter({
      gap: { ...gap, lines: [{ key: "gross-other", title: "Brut plus bas", detail: "", amount: -20, kind: "unknown" }] },
      year: 2026, month: 2, date: new Date("2026-04-02T10:00:00"), recipient: "Mme Martin", message: "", fullName: "",
    });
    expect(letter.subject).toBe("Objet : écart sur mon bulletin de paie de mars 2026");
    expect(plain(letter.paragraphs[1])).toBe("Une différence de 20,00 € sur le brut ne correspond à aucune ligne que j’aie pu identifier.");
    expect(letter.recipient).toBe("Mme Martin");
  });

  it("nomme le PDF d’après le mois du bulletin", () => {
    expect(payslipLetterPdfName(2026, 9)).toBe("courrier-bulletin-2026-10.pdf");
  });
});
