import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GPRMN_CONTACTS,
  mailComposeHref,
  POMPIDOU_CONTACT_SECTIONS,
  UsefulContactsSection,
} from "./UsefulContactsSection";

describe("contacts utiles", () => {
  it("présente les deux annuaires dans l’ordre demandé", () => {
    const html = renderToStaticMarkup(<UsefulContactsSection />);
    expect(html.indexOf("Contacts Pompidou")).toBeLessThan(html.indexOf("Contact GP‑RMN"));
    expect(POMPIDOU_CONTACT_SECTIONS.map((section) => section.title)).toEqual([
      "RAS",
      "Bureau administratif",
      "Ressources humaines",
      "Service médical",
      "Service informatique",
      "Tickets restaurants",
    ]);
  });

  it("conserve tous les contacts et coordonnées fournis", () => {
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "ras")?.contacts).toHaveLength(10);
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "administration")?.contacts).toHaveLength(10);
    expect(
      POMPIDOU_CONTACT_SECTIONS
        .filter((section) => section.key !== "tickets")
        .flatMap((section) => section.contacts)
        .every((contact) => Boolean(contact.email)),
    ).toBe(true);
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "ras")?.contacts[0].email).toBe(
      "maarten.averink@centrepompidou.fr",
    );
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "administration")?.contacts.at(-1)?.email).toBe(
      "absenceSAP@gmail.com",
    );
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "administration")?.contacts[6].email).toBe(
      "aurelia.debie@centrepompidou.fr",
    );
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "ras")?.contacts[6].phones?.[0].allowCall).toBe(false);
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "rh")?.contacts[0].email).toBe(
      "administration.RH@centrepompidou.fr",
    );
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "medical")?.contacts[0].email).toBe(
      "servicemedical@centrepompidou.fr",
    );
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "it")?.contacts[0].email).toBe(
      "assistance@centrepompidou.fr",
    );
    expect(POMPIDOU_CONTACT_SECTIONS.find((section) => section.key === "tickets")?.contacts[0].phones?.[0].number).toBe(
      "0144784148",
    );
    expect(GPRMN_CONTACTS.map((contact) => contact.name)).toEqual([
      "Accident · secourisme",
      "Superviseur Expo",
    ]);
    expect(mailComposeHref("maarten.averink@centrepompidou.fr")).toBe(
      "mailto:maarten.averink@centrepompidou.fr",
    );
    const rasEmails = POMPIDOU_CONTACT_SECTIONS
      .find((section) => section.key === "ras")!
      .contacts.map((contact) => contact.email!);
    expect(rasEmails).toHaveLength(10);
    expect(mailComposeHref(rasEmails)).toBe(`mailto:${rasEmails.join(",")}`);
  });
});
