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
        person("Spasa Lesage", [{ number: "0764374982" }]),
        person("Mathieu Bohet", [{ number: "0778669235" }]),
        person("Alice Toumine", [{ number: "0763731643", allowCall: false }]),
        person("Francis Meunier", [{ number: "0646887765" }]),
        person("Mohamed Lamri", [{ number: "0621688126" }]),
        person("Guillaume Fayon", [{ number: "0621688365" }]),
        person("Magali Cheval", [{ label: "Portable", number: "0634251464" }, { label: "Bureau", number: "0144784139" }]),
        person("Alain Sicard", [{ number: "0634253538" }]),
      ],
    },
    {
      key: "administration",
      title: "Bureau administratif",
      contacts: [
        person("Laurence Nida", [{ label: "Bureau", number: "0144784053" }, { label: "Portable", number: "0621688415" }]),
        person("Mathilde Lucchini", [{ label: "Bureau", number: "0144784036" }, { label: "Portable", number: "0662906793" }]),
        person("John Lorenc", [{ number: "0144784919" }, { number: "0614319695" }]),
        person("Isabelle Honoré", [{ label: "Bureau", number: "0144781668" }, { label: "Portable", number: "0650621114" }]),
        person("Sarah Rodrigues", [{ label: "Bureau", number: "0144784787" }, { label: "Portable", number: "0662477642" }]),
        person("Aurélia De Bie", [{ label: "Bureau", number: "0144784488" }, { label: "Portable", number: "0785407502" }], "aurelia.debie"),
        person("Esther Ladu", [{ label: "Bureau", number: "0144784968" }, { label: "Portable", number: "0621688266" }]),
        person("Agnès Laurent", [{ label: "Bureau", number: "0144781461" }, { label: "Portable", number: "0611235352" }]),
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
  // Fiche « Service de l'accueil des publics » du Grand Palais, rangée par
  // thème (l'écran suit l'ordre des thèmes), sans la régie, l'informatique,
  // les standards, l'audiovisuel, le superviseur évènementiel ni Universcience,
  // écartés par l'utilisateur.
  gprmn: [
    { name: "Sûreté", theme: "Urgences", radioChannel: 2, context: "Malveillance, altercation", phones: [{ number: "0144131750" }] },
    { name: "Sécurité", theme: "Urgences", radioChannel: 3, context: "Accident, incendie", phones: [{ number: "0144131753" }] },
    { name: "RAS-RAI", theme: "Encadrement", radioChannel: 10, phones: [{ number: "0144131774" }] },
    { name: "Responsables accueil et caisses", theme: "Encadrement", radioChannel: 11, phones: [{ number: "0626287703", allowSms: false }, { number: "0144131746" }] },
    { name: "Superviseur PC", theme: "Encadrement", phones: [{ number: "0611793883", allowSms: false }, { number: "0144131724" }] },
    { name: "Superviseur expositions", theme: "Encadrement", phones: [{ number: "0646406588", allowSms: false }] },
    { name: "Information Hall", theme: "Hall", phones: [{ number: "0144131764" }] },
    { name: "Accueil groupes Hall", theme: "Hall", phones: [{ number: "0144131769" }] },
    { name: "Billetterie Hall", theme: "Hall", phones: [{ number: "0144131763" }] },
    { name: "Information Rotonde", theme: "Rotonde", phones: [{ number: "0144131715" }] },
    { name: "Billetterie Rotonde milieu", theme: "Rotonde", phones: [{ number: "0144131762" }] },
    { name: "Billetterie Rotonde droite", theme: "Rotonde", phones: [{ number: "0144131794" }] },
    { name: "Réclamations visiteurs", theme: "Visiteurs", email: "contact@grandpalaisrmn.fr" },
  ],
};
