import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mailComposeHref, UsefulContactsSection } from "./UsefulContactsSection";
import type { UsefulContactsPayload } from "./usefulContactsTypes";
import { USEFUL_CONTACTS_DATA } from "../netlify/lib/usefulContactsData.mjs";

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
  it("conserve le fixe et ajoute le portable de John Lorenc", () => {
    const john = USEFUL_CONTACTS_DATA.pompidou.flatMap(section => section.contacts).find(contact => contact.name === "John Lorenc");
    expect(john?.phones?.map(phone => phone.number)).toEqual(["0144784919", "0614319695"]);
  });
  it("présente les annuaires et une recherche ciblée", () => {
    const html = renderToStaticMarkup(
      <UsefulContactsSection initialData={CONTACTS_FIXTURE} />,
    );
    expect(html).toContain("useful-contacts-root");
    expect(html.indexOf("Contacts Pompidou")).toBeLessThan(html.indexOf("Contact GP‑RMN"));
    expect(html).toContain("Rechercher une personne ou un service");
    expect(html).not.toContain("0100000000");
    expect(html).not.toContain("›");
  });

  it("ajoute l’annuaire des codes radio quand le serveur les envoie", () => {
    const withCodes = renderToStaticMarkup(
      <UsefulContactsSection initialData={{ ...CONTACTS_FIXTURE, radioCodes: [{ code: "FOX", meaning: "Alerte Feu" }, { code: "TANGO", meaning: "Attaque Terroriste" }] }} />,
    );
    expect(withCodes).toContain("Codes urgences radio");
    expect(withCodes).toContain("2 codes d’urgence");
    expect(withCodes.indexOf("Pour les visiteurs")).toBeLessThan(withCodes.indexOf("Codes urgences radio"));
    // Sans codes reçus (ancienne réponse), pas d'annuaire vide.
    expect(renderToStaticMarkup(<UsefulContactsSection initialData={CONTACTS_FIXTURE} />)).not.toContain("Codes urgences radio");
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
