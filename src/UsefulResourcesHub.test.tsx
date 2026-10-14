import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsefulResourcesHub } from "./UsefulResourcesHub";

describe("choix des documents et contacts", () => {
  it("présente deux onglets avant de monter une page", () => {
    const html = renderToStaticMarkup(
      <UsefulResourcesHub
        forms={<div>Page des formulaires</div>}
        contacts={<div>Page des contacts</div>}
      />,
    );

    expect(html).toContain("Formulaires");
    expect(html).toContain("Contacts");
    // Les plannings PDF s’ouvrent désormais depuis le calendrier de l’accueil.
    expect(html).not.toContain("Plannings PDF");
    expect(html).toContain("Les formulaires et les numéros utiles.");
    // Une icône par rubrique, avec ce qu'on y trouve et une flèche.
    expect(html.match(/useful-resource-tab-art[^>]*><svg/g)).toHaveLength(2);
    expect(html).toContain("Numéros utiles et services du musée");
    expect(html).not.toContain("Toutes les rubriques");
    expect(html).not.toContain("Page des formulaires");
    expect(html).not.toContain("Page des contacts");
  });
});
