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
    expect(pompidou.find((section) => section.key === "ras")?.contacts).toHaveLength(12);
    expect(pompidou.find((section) => section.key === "administration")?.contacts).toHaveLength(9);
    expect(pompidou.find((section) => section.key === "ras")?.contacts[0].email).toBe("maarten.averink@centrepompidou.fr");
    expect(pompidou.find((section) => section.key === "administration")?.contacts.at(-1)?.email).toBe("absenceSAP@gmail.com");
    expect(pompidou.find((section) => section.key === "administration")?.contacts.find((contact) => contact.name === "Aurélia De Bie")?.email).toBe("aurelia.debie@centrepompidou.fr");
    expect(pompidou.find((section) => section.key === "ras")?.contacts[6].phones?.[0].allowCall).toBe(false);
    expect(pompidou.find((section) => section.key === "tickets")?.contacts[0].phones?.[0].number).toBe("0144784148");
    expect(gprmn).toHaveLength(13);
    expect(gprmn.slice(0, 4).map((contact) => [contact.name, contact.radioChannel, contact.context, contact.phones?.[0].number])).toEqual([
      ["Sûreté", 2, "Malveillance, altercation", "0144131750"],
      ["Sécurité", 3, "Accident, incendie", "0144131753"],
      ["RAS-RAI", 10, undefined, "0144131774"],
      ["Responsables accueil et caisses", 11, undefined, "0626287703"],
    ]);
  });

  it("reprend la fiche du service de l’accueil des publics d’octobre 2026", () => {
    const all = [...USEFUL_CONTACTS_DATA.pompidou.flatMap((section) => section.contacts), ...USEFUL_CONTACTS_DATA.gprmn];
    const numbers = (name: string) => all.find((contact) => contact.name === name)?.phones?.map((phone) => phone.number);
    const ras = USEFUL_CONTACTS_DATA.pompidou.find((section) => section.key === "ras")?.contacts.map((contact) => contact.name);
    expect(ras).toEqual(expect.arrayContaining(["Magali Cheval", "Alain Sicard"]));
    expect(numbers("Spasa Lesage")).toEqual(["0764374982"]);
    expect(numbers("Alain Sicard")).toEqual(["0634253538"]);
    expect(numbers("Magali Cheval")).toEqual(["0634251464", "0144784139"]);
    expect(numbers("Aurélia De Bie")).toEqual(["0144784488", "0785407502"]);
    expect(numbers("Esther Ladu")).toEqual(["0144784968", "0621688266"]);
    expect(numbers("Agnès Laurent")).toEqual(["0144781461", "0611235352"]);
    expect(numbers("Superviseur PC")).toEqual(["0611793883", "0144131724"]);
    // Ni SMS pour les portables des responsables et des superviseurs.
    for (const name of ["Responsables accueil et caisses", "Superviseur PC", "Superviseur expositions"])
      expect(all.find((contact) => contact.name === name)?.phones?.[0].allowSms).toBe(false);
    // Écartés à la demande de l'utilisateur.
    const names = all.map((contact) => contact.name);
    for (const removed of ["Régie de recettes", "Informatique et téléphonie", "Standard SAV", "Standard Centre Pompidou", "Permanence service audiovisuel", "Superviseur évènementiel", "Universcience"])
      expect(names).not.toContain(removed);
  });

  it("range chaque contact GP-RMN sous un thème, thèmes regroupés dans l’ordre", () => {
    const themes = USEFUL_CONTACTS_DATA.gprmn.map((contact) => contact.theme);
    expect(themes.every(Boolean)).toBe(true);
    // Chaque thème d'un seul tenant : l'écran les montre dans cet ordre.
    expect(themes.filter((theme, index) => theme !== themes[index - 1])).toEqual(["Urgences", "Encadrement", "Hall", "Rotonde", "Visiteurs"]);
  });

  it("ne garde aucun doublon : ni nom, ni numéro, ni adresse", () => {
    const all = [...USEFUL_CONTACTS_DATA.pompidou.flatMap((section) => section.contacts), ...USEFUL_CONTACTS_DATA.gprmn];
    const repeated = (values: string[]) => values.filter((value, index) => values.indexOf(value) !== index);
    expect(repeated(all.map((contact) => contact.name.toLowerCase()))).toEqual([]);
    expect(repeated(all.flatMap((contact) => contact.phones?.map((phone) => phone.number) ?? []))).toEqual([]);
    expect(repeated(all.flatMap((contact) => (contact.email ? [contact.email.toLowerCase()] : [])))).toEqual([]);
  });
});
