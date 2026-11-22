import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resourceTabDetail, UsefulResourcesHub } from "./UsefulResourcesHub";

describe("documents et contacts", () => {
  it("ouvre directement les formulaires, Contacts à côté, sans écran d’entrée", () => {
    const html = renderToStaticMarkup(
      <UsefulResourcesHub
        forms={<div>Page des formulaires</div>}
        contacts={<div>Page des contacts</div>}
      />,
    );
    // Tant que les nombres ne sont pas connus, chaque tuile dit ce qu'elle range.
    expect(html).toContain('role="tab" aria-selected="true" aria-controls="useful-resource-panel-forms" aria-label="Formulaires, Dossiers"');
    expect(html).toContain('aria-label="Contacts, Annuaires"');
    expect(html).toContain('<span class="useful-resource-tab-copy"><strong>Formulaires</strong><small>Dossiers</small></span>');
    expect(html).toContain("Page des formulaires");
    expect(html).not.toContain("Page des contacts");
    expect(html).not.toContain("Choisir une rubrique");
    expect(html).not.toContain("Toutes les rubriques");
    // Les plannings PDF s’ouvrent depuis le calendrier de l’accueil : deux
    // onglets seulement, Formulaires et Contacts, dans l'écran des ressources.
    expect(html).not.toContain("Plannings PDF");
    expect([...html.matchAll(/role="tab"[^>]*aria-label="([^"]+)"/g)].map((match) => match[1])).toEqual(["Formulaires, Dossiers", "Contacts, Annuaires"]);
    // Chaque tuile a son dessin, dans une case que les lecteurs d'écran ignorent.
    expect(html.match(/<span class="useful-resource-tab-mark" aria-hidden="true"><svg /g)).toHaveLength(2);
    expect(html).toContain("useful-resources-screen");
  });

  it("annonce sur chaque tuile ce qu’elle contient, dès que le nombre est connu", () => {
    const html = renderToStaticMarkup(
      <UsefulResourcesHub forms={<div>F</div>} contacts={<div>C</div>} counts={{ forms: 11, contacts: 46 }} />,
    );
    expect(html).toContain('<span class="useful-resource-tab-copy"><strong>Formulaires</strong><small>11 documents</small></span>');
    expect(html).toContain('<span class="useful-resource-tab-copy"><strong>Contacts</strong><small>46 contacts</small></span>');
    expect([...html.matchAll(/role="tab"[^>]*aria-label="([^"]+)"/g)].map((match) => match[1])).toEqual(["Formulaires, 11 documents", "Contacts, 46 contacts"]);
    // Un seul nombre connu : l'autre tuile garde ce qu'elle range.
    const partial = renderToStaticMarkup(<UsefulResourcesHub forms={<div>F</div>} contacts={<div>C</div>} counts={{ forms: 1, contacts: null }} />);
    expect(partial).toContain("<small>1 document</small>");
    expect(partial).toContain("<small>Annuaires</small>");
    expect(resourceTabDetail(0, "document", "Dossiers")).toBe("Aucun document");
    expect(resourceTabDetail(1, "contact", "Annuaires")).toBe("1 contact");
    expect(resourceTabDetail(undefined, "contact", "Annuaires")).toBe("Annuaires");
  });

  it("peut s’ouvrir sur les contacts", () => {
    const html = renderToStaticMarkup(<UsefulResourcesHub forms={<div>F</div>} contacts={<div>Page des contacts</div>} initialTab="contacts" />);
    expect(html).toContain("Page des contacts");
  });
});
