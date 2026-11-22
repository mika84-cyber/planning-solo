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
  });

  it("présente les QR codes en fiches, les mêmes pour tous les comptes", () => {
    const html = renderToStaticMarkup(<VisitorQrLinks />);
    // Une icône par fiche, et la liste marquée pour les règles des fiches
    // (usefulDocumentAdmin.css) : ni rang de sommaire, ni couleur de dossier.
    expect(html).toContain('<div class="useful-form-download-list visitor-qr-list doc-cards">');
    expect(html.match(/<span class="useful-form-file-icon useful-audioguide-icon" aria-hidden="true">/g)).toHaveLength(2);
    expect(html).not.toContain("useful-form-number");
    expect(html).not.toContain("--contact-category-accent");
  });

  it("ajoute « Pour les visiteurs » aux annuaires des contacts", () => {
    const html = renderToStaticMarkup(<UsefulContactsSection initialData={{ pompidou: [], gprmn: [] }} />);
    expect(html).toContain("Pour les visiteurs");
    expect(html).toContain("2 QR codes");
    expect(html.indexOf("Contact GP‑RMN")).toBeLessThan(html.indexOf("Pour les visiteurs"));
  });
});
