import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsefulContactsSection } from "./UsefulContactsSection";
import { VISITOR_QR_LINKS, VisitorQrLinks } from "./VisitorQrLinks";

describe("QR codes pour les visiteurs", () => {
  it("propose la réclamation et l'objet perdu, à ouvrir sans scanner", () => {
    expect(VISITOR_QR_LINKS.map((link) => [link.title, link.url])).toEqual([
      ["Réclamation service client", "https://l.ead.me/bg72nl"],
      ["Objet perdu", "https://l.ead.me/bg72lH"],
    ]);
    const html = renderToStaticMarkup(<VisitorQrLinks />);
    expect(html).toContain('href="https://l.ead.me/bg72nl"');
    expect(html).toContain('href="https://l.ead.me/bg72lH"');
    expect(html).toContain("Afficher le QR code");
    // Même sommaire numéroté que les documents : un rang, plus d'icône.
    expect(html.match(/<span class="useful-form-number" aria-hidden="true">\d<\/span>/g)).toEqual([
      '<span class="useful-form-number" aria-hidden="true">1</span>',
      '<span class="useful-form-number" aria-hidden="true">2</span>',
    ]);
    expect(html).not.toContain("useful-form-file-icon");
    expect(html).toContain("--contact-category-accent:#c9623a");
  });

  it("garde les fiches d'avant le sommaire pour le compte administrateur", () => {
    const html = renderToStaticMarkup(<VisitorQrLinks cards />);
    // Une icône à la place du rang, et la liste marquée pour ses règles de
    // fiche (usefulDocumentAdmin.css), sans couleur de dossier.
    expect(html).toContain('<div class="useful-form-download-list visitor-qr-list doc-cards">');
    expect(html.match(/<span class="useful-form-file-icon useful-audioguide-icon" aria-hidden="true">/g)).toHaveLength(2);
    expect(html).not.toContain("useful-form-number");
    expect(html).not.toContain("--contact-category-accent");
    expect(html).toContain('href="https://l.ead.me/bg72nl"');
    // Les autres comptes gardent le sommaire.
    expect(renderToStaticMarkup(<VisitorQrLinks />)).toContain('<div class="useful-form-download-list visitor-qr-list" style=');
  });

  it("ajoute « Pour les visiteurs » aux annuaires des contacts", () => {
    const html = renderToStaticMarkup(<UsefulContactsSection initialData={{ pompidou: [], gprmn: [] }} />);
    expect(html).toContain("Pour les visiteurs");
    expect(html).toContain("2 QR codes");
    expect(html.indexOf("Contact GP‑RMN")).toBeLessThan(html.indexOf("Pour les visiteurs"));
  });
});
