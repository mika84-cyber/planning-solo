import type {
  UsefulContact,
  UsefulContactsPayload,
} from "../../src/usefulContactsTypes.ts";

function pompidouEmail(name: string, localPart?: string) {
  const generated = name
    .replace(/\s*\([^)]*\)\s*/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/[\s'’-]+/)
    .filter(Boolean)
    .join(".");
  return `${localPart || generated}@centrepompidou.fr`;
}

function person(
  name: string,
  phones: UsefulContact["phones"],
  emailLocalPart?: string,
): UsefulContact {
  return { name, email: pompidouEmail(name, emailLocalPart), phones };
}

export const USEFUL_CONTACTS_DATA: UsefulContactsPayload = {
  pompidou: [
    {
      key: "ras",
      title: "RAS",
      contacts: [
        person("Maarten Averink", [{ number: "0621688308" }]),
        person("Hicham Azalmat", [{ number: "0651597253" }]),
        person("Wilnise Cedelle", [{ number: "0764374984" }]),
        person("Isabelle Mercier", [{ number: "0699733979" }]),
        person("Spasa Lesage", [{ number: "0778647213" }]),
        person("Mathieu Bohet", [{ number: "0778669235" }]),
        person("Alice Toumine", [{ number: "0763731643", allowCall: false }]),
        person("Francis Meunier", [{ number: "0646887765" }]),
        person("Mohamed Lamri", [{ number: "0621688126" }]),
        person("Guillaume Fayon", [{ number: "0621688365" }]),
      ],
    },
    {
      key: "administration",
      title: "Bureau administratif",
      contacts: [
        person("Laurence Nida", [{ label: "Bureau", number: "0144784053" }, { label: "Portable", number: "0621688415" }]),
        person("Mathilde Lucchini", [{ label: "Bureau", number: "0144784036" }, { label: "Portable", number: "0662906793" }]),
        person("John Lorenc", [{ number: "0144784919" }]),
        person("Magali Cheval", [{ number: "0144784139" }]),
        person("Isabelle Honoré", [{ label: "Bureau", number: "0144781668" }, { label: "Portable", number: "0650621114" }]),
        person("Sarah Rodrigues", [{ label: "Bureau", number: "0144784787" }, { label: "Portable", number: "0662477642" }]),
        person("Aurélia De Bie", [{ number: "0144784488" }], "aurelia.debie"),
        person("Esther Ladu", [{ number: "0144784968" }]),
        person("Agnès Laurent", [{ number: "0144781461" }]),
        { name: "Mail générique Aurélia, Esther et Agnès", email: "absenceSAP@gmail.com", singleLineLabel: true },
      ],
    },
    {
      key: "rh",
      title: "Ressources humaines",
      contacts: [
        { name: "Adresse générique", email: "administration.RH@centrepompidou.fr" },
        person("Alexandre Roma", [{ number: "0144784021" }]),
        person("Saddi Haddar", [{ number: "0144781258" }]),
        person("David Tahraoui", [{ number: "0144784073" }]),
        person("Sarra Kardouci", [{ number: "0144781357" }]),
        person("Ammara Laouedj", [{ number: "0144784793" }]),
        person("Clothilde Letourneur", [{ number: "0144784914" }]),
        person("Jeanne Seline", [{ number: "0144784975" }]),
        person("Stéphanie Bodiou (comptable)", [{ number: "0144784035" }]),
      ],
    },
    {
      key: "medical",
      title: "Service médical",
      contacts: [{ name: "Service médical", email: "servicemedical@centrepompidou.fr", phones: [{ number: "0144784986" }] }],
    },
    {
      key: "it",
      title: "Service informatique",
      contacts: [{ name: "Assistance informatique", email: "assistance@centrepompidou.fr", phones: [{ number: "0144784754" }] }],
    },
    {
      key: "tickets",
      title: "Tickets restaurants",
      contacts: [{ name: "Tickets restaurants", phones: [{ number: "0144784148" }] }],
    },
  ],
  gprmn: [
    { name: "Accident · secourisme", phones: [{ number: "0144131750" }] },
    { name: "Superviseur Expo", phones: [{ number: "0646406588" }] },
  ],
};
