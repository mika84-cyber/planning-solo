import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getUsefulFormAction, USEFUL_FORM_FOLDERS, UsefulFormsSection } from "./UsefulFormsSection";

describe("formulaires utiles", () => {
  it("présente les trois dossiers dans l’ordre demandé", () => {
    const html = renderToStaticMarkup(<UsefulFormsSection />);
    expect(USEFUL_FORM_FOLDERS.map((folder) => folder.title)).toEqual([
      "Formulaire Expo",
      "Formulaire SAP",
      "Formulaire Brantôme",
    ]);
    expect(html.indexOf("Formulaire Expo")).toBeLessThan(html.indexOf("Formulaire SAP"));
    expect(html.indexOf("Formulaire SAP")).toBeLessThan(html.indexOf("Formulaire Brantôme"));
    expect(html).toContain("1 document");
  });

  it("conserve l’ordre exact des documents Expo, SAP et Brantôme", () => {
    expect(USEFUL_FORM_FOLDERS.find((folder) => folder.key === "expo")?.documents.map((item) => item.file)).toEqual([
      "hilma-af-klint.pdf",
    ]);
    expect(USEFUL_FORM_FOLDERS.find((folder) => folder.key === "sap")?.documents.map((item) => item.file)).toEqual([
      "demande-conges.pdf",
      "demande-recuperations.pdf",
      "demande-annulation-conges.pdf",
    ]);
    expect(USEFUL_FORM_FOLDERS.find((folder) => folder.key === "brantome")?.documents.map((item) => item.file)).toEqual([
      "formulaire-changement-coordonnees.pdf",
      "changement-coordonnees-bancaires.docx",
      "demande-carte-restauration-bimpli.pdf",
      "procuration-retrait-titres-repas.pdf",
      "demande-carte-culture-a.pdf",
      "cet-demande-ouverture.pdf",
      "cet-alimentation-indemnisation.pdf",
    ]);
  });

  it("ouvre les PDF dans le lecteur sur une adresse locale non sécurisée", () => {
    expect(getUsefulFormAction("PDF", false)).toBe("preview");
    expect(getUsefulFormAction("PDF", true)).toBe("download");
    expect(getUsefulFormAction("DOCX", false)).toBe("download");
  });
});
