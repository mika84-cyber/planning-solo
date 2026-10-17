import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsefulResourcesHub } from "./UsefulResourcesHub";

describe("documents et contacts", () => {
  it("ouvre directement les formulaires, Contacts à côté, sans écran d’entrée", () => {
    const html = renderToStaticMarkup(
      <UsefulResourcesHub
        forms={<div>Page des formulaires</div>}
        contacts={<div>Page des contacts</div>}
      />,
    );
    expect(html).toContain('role="tab" aria-selected="true" aria-controls="useful-resource-panel-forms" aria-label="Formulaires"');
    expect(html).toContain('aria-label="Contacts"');
    expect(html).toContain("Page des formulaires");
    expect(html).not.toContain("Page des contacts");
    expect(html).not.toContain("Choisir une rubrique");
    expect(html).not.toContain("Toutes les rubriques");
    // Les plannings PDF s’ouvrent depuis le calendrier de l’accueil.
    expect(html).not.toContain("Plannings PDF");
  });

  it("peut s’ouvrir sur les contacts", () => {
    const html = renderToStaticMarkup(<UsefulResourcesHub forms={<div>F</div>} contacts={<div>Page des contacts</div>} initialTab="contacts" />);
    expect(html).toContain("Page des contacts");
  });
});
