import { describe, expect, it } from "vitest";
import { USEFUL_CONTACTS_DATA } from "./usefulContactsData.mts";

describe("annuaire sécurisé", () => {
  it("conserve toutes les coordonnées côté serveur uniquement", () => {
    const { pompidou, gprmn } = USEFUL_CONTACTS_DATA;
    expect(pompidou.map((section) => section.title)).toEqual([
      "RAS",
      "Bureau administratif",
      "Ressources humaines",
      "Service médical",
      "Service informatique",
      "Tickets restaurants",
    ]);
    expect(pompidou.find((section) => section.key === "ras")?.contacts).toHaveLength(10);
    expect(pompidou.find((section) => section.key === "administration")?.contacts).toHaveLength(10);
    expect(pompidou.find((section) => section.key === "ras")?.contacts[0].email).toBe("maarten.averink@centrepompidou.fr");
    expect(pompidou.find((section) => section.key === "administration")?.contacts.at(-1)?.email).toBe("absenceSAP@gmail.com");
    expect(pompidou.find((section) => section.key === "administration")?.contacts[6].email).toBe("aurelia.debie@centrepompidou.fr");
    expect(pompidou.find((section) => section.key === "ras")?.contacts[6].phones?.[0].allowCall).toBe(false);
    expect(pompidou.find((section) => section.key === "tickets")?.contacts[0].phones?.[0].number).toBe("0144784148");
    expect(gprmn.map((contact) => contact.name)).toEqual(["Accident · secourisme", "Superviseur Expo"]);
  });
});
