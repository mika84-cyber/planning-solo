import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsefulResourcesHub } from "./UsefulResourcesHub";

describe("choix des documents et contacts", () => {
  it("présente trois onglets avant de monter une page", () => {
    const html = renderToStaticMarkup(
      <UsefulResourcesHub
        forms={<div>Page des formulaires</div>}
        contacts={<div>Page des contacts</div>}
        pdf={<div>Page des PDF</div>}
      />,
    );

    expect(html).toContain("Formulaires");
    expect(html).toContain("Contacts");
    expect(html).toContain("Plannings PDF");
    expect(html).toContain("Vos plannings à télécharger, les formulaires et les numéros utiles.");
    // Une icône par rubrique, avec ce qu'on y trouve et une flèche.
    expect(html.match(/useful-resource-tab-art[^>]*><svg/g)).toHaveLength(3);
    expect(html).toContain("Numéros utiles et services du musée");
    expect(html).not.toContain("Toutes les rubriques");
    expect(html).not.toContain("Page des formulaires");
    expect(html).not.toContain("Page des contacts");
    expect(html).not.toContain("Page des PDF");
  });
});
