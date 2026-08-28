import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mailComposeHref, UsefulContactsSection } from "./UsefulContactsSection";
import type { UsefulContactsPayload } from "./usefulContactsTypes";

const CONTACTS_FIXTURE: UsefulContactsPayload = {
  pompidou: [
    {
      key: "ras",
      title: "RAS",
      contacts: [{ name: "Personne test", email: "personne.test@example.test" }],
    },
  ],
  gprmn: [{ name: "Service test", phones: [{ number: "0100000000" }] }],
};

describe("contacts utiles", () => {
  it("présente les annuaires et la recherche lorsque les données sont chargées", () => {
    const html = renderToStaticMarkup(
      <UsefulContactsSection initialData={CONTACTS_FIXTURE} />,
    );
    expect(html).toContain("useful-contacts-root");
    expect(html.indexOf("Contacts Pompidou")).toBeLessThan(html.indexOf("Contact GP‑RMN"));
    expect(html).toContain("Rechercher dans les contacts");
    expect(html).not.toContain("0100000000");
  });

  it("n’affiche aucune coordonnée avant le chargement authentifié", () => {
    const html = renderToStaticMarkup(<UsefulContactsSection />);
    expect(html).toContain("Chargement de l’annuaire sécurisé");
    expect(html).toContain("uniquement après votre connexion");
  });

  it("prépare les liens de messagerie individuels et groupés", () => {
    expect(mailComposeHref("personne.test@example.test")).toBe("mailto:personne.test@example.test");
    expect(mailComposeHref(["a@example.test", "b@example.test"])).toBe("mailto:a@example.test,b@example.test");
  });
});
