import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getUsefulFormAction,
  USEFUL_FORM_FOLDERS,
  UsefulFormsSection,
  usefulFormFoldersForDate,
} from "./UsefulFormsSection";

describe("formulaires utiles", () => {
  it("présente les quatre rubriques dans l’ordre demandé", () => {
    const html = renderToStaticMarkup(<UsefulFormsSection today="2026-09-01" />);
    expect(USEFUL_FORM_FOLDERS.map((folder) => folder.title)).toEqual([
      "Formulaire Expo",
      "Formulaire SAP",
      "Formulaire Brantôme",
      "Horaires tickets resto",
    ]);
    expect(html.indexOf("Formulaire Expo")).toBeLessThan(html.indexOf("Formulaire SAP"));
    expect(html.indexOf("Formulaire SAP")).toBeLessThan(html.indexOf("Formulaire Brantôme"));
    expect(html.indexOf("Formulaire Brantôme")).toBeLessThan(html.indexOf("Horaires tickets resto"));
    expect(html.indexOf("Horaires tickets resto")).toBeLessThan(html.indexOf("Déclarer un accident de travail"));
    expect(html).toContain("useful-forms-root");
    expect(html).toContain("Rechercher un document");
    expect(html).toContain("Vide pour le moment");
    expect(html).not.toContain("Hilma Af Klint");
    expect(html).toContain("Information pratique");
    expect(html).toContain("Déclarer un accident de travail");
    expect(html).toContain("useful-form-work-accident-entry");
    expect(html).toContain("/work-accident-icon.png");
    expect(html).not.toContain("›");
  });

  it("réserve la rubrique tickets repas à l’image fournie", () => {
    const tickets = USEFUL_FORM_FOLDERS.find((folder) => folder.key === "tickets");
    expect(tickets?.documents).toEqual([]);
    expect(tickets?.image?.src).toBe("/useful-forms/horaires-tickets-repas-fast.webp");
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

  it("retire automatiquement une fiche Expo lorsque l’exposition se termine", () => {
    expect(usefulFormFoldersForDate("2026-08-30").find((folder) => folder.key === "expo")?.documents)
      .toEqual([expect.objectContaining({ file: "hilma-af-klint.pdf" })]);
    expect(usefulFormFoldersForDate("2026-08-31").find((folder) => folder.key === "expo")?.documents)
      .toEqual([]);
  });

  it("ouvre les PDF dans le lecteur sur une adresse locale non sécurisée", () => {
    expect(getUsefulFormAction("PDF", false)).toBe("preview");
    expect(getUsefulFormAction("PDF", true)).toBe("download");
    expect(getUsefulFormAction("DOCX", false)).toBe("download");
  });

  it("affiche l’ajout et l’option d’alerte uniquement pour l’administrateur", () => {
    const guestHtml = renderToStaticMarkup(<UsefulFormsSection />);
    const adminHtml = renderToStaticMarkup(<UsefulFormsSection isAdmin />);
    expect(guestHtml).not.toContain("Ajouter un document");
    expect(adminHtml).not.toContain("Ajouter un document");
    expect(adminHtml).not.toContain("Alerter tous les comptes invités");
    expect(adminHtml).not.toContain("checked=\"\"");
  });
});
