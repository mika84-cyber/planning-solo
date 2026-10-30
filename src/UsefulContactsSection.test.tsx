import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ContactCards, ContactThemePanels, contactThemes, mailComposeHref, nameWithinTheme, UsefulContactsSection } from "./UsefulContactsSection";
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

describe("carte de contact", () => {
  const surete = { name: "Sûreté", radioChannel: 2, context: "Malveillance, altercation", phones: [{ number: "0144131750" }] };

  it("met le canal radio à côté du nom, la précision dessous", () => {
    const html = renderToStaticMarkup(<ContactCards contacts={[surete]} isAdmin={false} onEdit={vi.fn()} />);
    expect(html).toContain('<span class="useful-contact-title"><strong>Sûreté</strong><em class="useful-contact-radio"><span class="visually-hidden">radio, </span>Canal 2</em></span><small>Malveillance, altercation</small>');
  });

  it("ne réserve la place du bouton ✎ qu’à l’administrateur", () => {
    const guest = renderToStaticMarkup(<ContactCards contacts={[surete]} isAdmin={false} onEdit={vi.fn()} />);
    const admin = renderToStaticMarkup(<ContactCards contacts={[surete]} isAdmin onEdit={vi.fn()} />);
    expect(guest).not.toContain("useful-contact-card-editable");
    expect(guest).not.toContain("contact-admin-edit");
    expect(admin).toContain('class="useful-contact-card useful-contact-card-editable"');
    expect(admin).toContain('aria-label="Modifier Sûreté"');
  });

  it("range les contacts par thème, ceux sans thème en dernier", () => {
    const themes = contactThemes([
      { name: "Ajouté sans thème", email: "a@example.test" },
      { name: "Sûreté", theme: "Urgences", phones: [{ number: "0144131750" }] },
      { name: "Billetterie Hall", theme: "Hall", phones: [{ number: "0144131763" }] },
      { name: "Sécurité", theme: "Urgences", phones: [{ number: "0144131753" }] },
    ]);
    expect(themes.map(({ theme, contacts }) => [theme, contacts.map((contact) => contact.name)])).toEqual([
      ["Urgences", ["Sûreté", "Sécurité"]],
      ["Hall", ["Billetterie Hall"]],
      ["Autres contacts", ["Ajouté sans thème"]],
    ]);
  });

  it("dit le nom sans le thème déjà écrit au-dessus", () => {
    expect(nameWithinTheme("Billetterie Rotonde milieu", "Rotonde")).toBe("Billetterie milieu");
    expect(nameWithinTheme("Information Hall", "Hall")).toBe("Information");
    expect(nameWithinTheme("Réclamations visiteurs", "Visiteurs")).toBe("Réclamations");
    expect(nameWithinTheme("Superviseur PC", "Encadrement")).toBe("Superviseur PC");
    expect(nameWithinTheme("Hall", "Hall")).toBe("Hall");
  });

  it("présente l’annuaire GP-RMN en panneaux de thème, une ligne par contact", () => {
    const contacts = [
      { name: "Sûreté", theme: "Urgences", radioChannel: 2, context: "Malveillance, altercation", phones: [{ number: "0144131750" }] },
      { name: "Superviseur PC", theme: "Encadrement", phones: [{ number: "0611793883" }, { number: "0144131724" }] },
      { name: "Billetterie Hall", theme: "Hall", phones: [{ number: "0144131763" }] },
      { name: "Réclamations visiteurs", theme: "Visiteurs", email: "contact@grandpalaisrmn.fr" },
    ];
    const html = renderToStaticMarkup(<ContactThemePanels contacts={contacts} isAdmin={false} onEdit={vi.fn()} />);
    expect(html).toContain('<section class="contact-theme-panel contact-theme-urgences" aria-labelledby="gprmn-theme-0"><header class="contact-theme-head"><span aria-hidden="true">!</span><h3 id="gprmn-theme-0">Urgences</h3><small>1<span class="visually-hidden"> contact</span></small></header>');
    expect(html).toContain('<span class="useful-contact-title"><strong>Sûreté</strong><em class="useful-contact-radio"><span class="visually-hidden">radio, </span>Canal 2</em></span><small>Malveillance, altercation</small>');
    expect(html).toContain('href="tel:+33144131750" aria-label="Appeler Sûreté au 01 44 13 17 50"');
    // Un portable propose aussi le SMS ; un fixe, non.
    expect(html).toContain('aria-label="Envoyer un SMS à Superviseur PC au 06 11 79 38 83"');
    expect(html).not.toContain("SMS à Superviseur PC au 01 44 13 17 24");
    // Sous « Hall », « Billetterie » suffit ; l'appel garde le nom entier.
    expect(html).toContain("<strong>Billetterie</strong>");
    expect(html).toContain('aria-label="Appeler Billetterie Hall au 01 44 13 17 63"');
    expect(html).toContain('aria-label="Écrire à Réclamations visiteurs avec l’application de messagerie"');
    expect(html).not.toContain("contact-theme-edit");
    expect(renderToStaticMarkup(<ContactThemePanels contacts={contacts} isAdmin onEdit={vi.fn()} />)).toContain('aria-label="Modifier Billetterie Hall"');
  });

  it("tait le SMS d’un portable marqué sans, et ne réserve alors pas sa colonne", () => {
    const html = renderToStaticMarkup(<ContactThemePanels contacts={[
      { name: "Superviseur PC", theme: "Encadrement", phones: [{ number: "0611793883", allowSms: false }, { number: "0144131724" }] },
      { name: "RAS-RAI", theme: "Encadrement", phones: [{ number: "0144131774" }] },
    ]} isAdmin={false} onEdit={vi.fn()} />);
    expect(html).toContain('aria-label="Appeler Superviseur PC au 06 11 79 38 83"');
    expect(html).not.toContain("SMS");
    expect(html).not.toContain("contact-theme-sms-space");
  });

  it("n’affiche pas de pastille sans canal", () => {
    const html = renderToStaticMarkup(<ContactCards contacts={[{ name: "Billetterie Hall", phones: [{ number: "0144131763" }] }]} isAdmin={false} onEdit={vi.fn()} />);
    expect(html).not.toContain("useful-contact-radio");
  });
});

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
