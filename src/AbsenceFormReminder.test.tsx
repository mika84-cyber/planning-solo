import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AbsenceFormReminder, absenceFormFor } from "./AbsenceFormReminder";
import { USEFUL_FORM_FOLDERS } from "./UsefulFormsSection";

const render = (title: string, previewOnly = false) => {
  const form = absenceFormFor(title)!;
  return renderToStaticMarkup(<AbsenceFormReminder title={title} form={form} previewOnly={previewOnly} onDownload={vi.fn()} onClose={vi.fn()} />);
};

describe("le rappel du formulaire avant de télécharger une demande d'absence", () => {
  it("reconnaît chaque demande du dossier SAP, y compris celles ajoutées par l'administrateur", () => {
    const sap = USEFUL_FORM_FOLDERS.find((folder) => folder.key === "sap")!;
    expect(sap.documents.map((document) => absenceFormFor(document.title)?.sheet)).toEqual(["conges", "recup", "annul"]);
    expect(absenceFormFor("Demande d'échange")?.sheet).toBe("echange");
    expect(absenceFormFor("Remplacement jour férié")?.sheet).toBe("ferie");
    expect(absenceFormFor("Consignes de la nouvelle exposition")).toBeNull();
  });

  it("propose d'abord de remplir la demande dans l'appli, sur la bonne feuille, et laisse le PDF vierge", () => {
    const html = render("Demande de congés");
    expect(html).toContain('role="dialog" aria-modal="true" aria-labelledby="absence-form-reminder-title"');
    expect(html).toContain('<span class="step-label">Demande de congés</span>');
    expect(html).toContain("Et si vous la remplissiez dans l’appli ?");
    expect(html).toContain('<a href="/formulaire/index.html?feuille=conges"><strong>Remplir dans l’appli</strong><small>Le formulaire s’ouvre sur la demande de congés</small></a>');
    expect(html).toContain('<button type="button"><strong>Télécharger le PDF vierge</strong><small>À imprimer et remplir à la main</small></button>');
    // Le formulaire d'abord, le PDF ensuite.
    expect(html.indexOf("Remplir dans l’appli")).toBeLessThan(html.indexOf("Télécharger le PDF vierge"));
  });

  it("accorde la phrase au document et ouvre le PDF dans le lecteur hors connexion sécurisée", () => {
    const html = render("Remplacement jour férié", true);
    expect(html).toContain("Et si vous le remplissiez dans l’appli ?");
    expect(html).toContain('href="/formulaire/index.html?feuille=ferie"');
    expect(html).toContain("Le formulaire s’ouvre sur le remplacement de jour férié");
    expect(html).toContain("<strong>Ouvrir le PDF vierge</strong>");
  });
});
