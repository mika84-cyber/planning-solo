import { useState } from "react";

type Phone = { label?: string; number: string; allowCall?: boolean };
type Contact = { name: string; email?: string; phones?: Phone[]; singleLineLabel?: boolean };
type PompidouSectionKey = "ras" | "administration" | "rh" | "medical" | "it" | "tickets";

type ContactSection = {
  key: PompidouSectionKey;
  title: string;
  contacts: Contact[];
};

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

function person(name: string, phones: Phone[], emailLocalPart?: string): Contact {
  return { name, email: pompidouEmail(name, emailLocalPart), phones };
}

export const POMPIDOU_CONTACT_SECTIONS: ContactSection[] = [
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
    contacts: [
      {
        name: "Service médical",
        email: "servicemedical@centrepompidou.fr",
        phones: [{ number: "0144784986" }],
      },
    ],
  },
  {
    key: "it",
    title: "Service informatique",
    contacts: [
      {
        name: "Assistance informatique",
        email: "assistance@centrepompidou.fr",
        phones: [{ number: "0144784754" }],
      },
    ],
  },
  {
    key: "tickets",
    title: "Tickets restaurants",
    contacts: [
      {
        name: "Tickets restaurants",
        phones: [{ number: "0144784148" }],
      },
    ],
  },
];

export const GPRMN_CONTACTS: Contact[] = [
  { name: "Accident · secourisme", phones: [{ number: "0144131750" }] },
  { name: "Superviseur Expo", phones: [{ number: "0646406588" }] },
];

function formatPhone(number: string) {
  return number.replace(/\D/g, "").replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

function phoneHref(number: string) {
  const digits = number.replace(/\D/g, "");
  return digits.startsWith("0") ? `tel:+33${digits.slice(1)}` : `tel:${digits}`;
}

function smsHref(number: string) {
  return phoneHref(number).replace(/^tel:/, "sms:");
}

function isMobilePhone(number: string) {
  return /^(06|07)/.test(number.replace(/\D/g, ""));
}

export function mailComposeHref(email: string | string[]) {
  const recipients = Array.isArray(email) ? email.join(",") : email;
  return `mailto:${recipients}`;
}

function contactInitials(name: string) {
  return name
    .replace(/\s*\([^)]*\)\s*/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ContactCards({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="useful-contact-list">
      {contacts.map((contact) => (
        <article className={`useful-contact-card${contact.singleLineLabel ? " useful-contact-card-single-line-label" : ""}`} key={contact.name}>
          <div className="useful-contact-identity">
            <span aria-hidden="true">{contactInitials(contact.name)}</span>
            <span>
              <strong>{contact.name}</strong>
            </span>
          </div>
          <div className="useful-contact-actions">
            {contact.email ? (
              <a
                href={mailComposeHref(contact.email)}
                className="useful-contact-email"
                aria-label={`Écrire à ${contact.name} avec l’application de messagerie`}
              >
                <b>{contact.email}</b>
              </a>
            ) : null}
            {contact.phones?.map((phone) => {
              const mobile = isMobilePhone(phone.number);
              const displayedNumber = formatPhone(phone.number);
              return (
                <div className={`useful-contact-phone${mobile ? " mobile" : " fixed"}`} key={`${contact.name}-${phone.number}`}>
                  <span>
                    <small>{phone.label || (mobile ? "Portable" : "Téléphone fixe")}</small>
                    <b>{displayedNumber}</b>
                  </span>
                  <span className="useful-contact-phone-actions">
                    {phone.allowCall !== false ? (
                      <a href={phoneHref(phone.number)} aria-label={`Appeler ${contact.name} au ${displayedNumber}`}>
                        <span aria-hidden="true">☎</span> Appeler
                      </a>
                    ) : null}
                    {mobile ? (
                      <a href={smsHref(phone.number)} aria-label={`Envoyer un SMS à ${contact.name} au ${displayedNumber}`}>
                        <span aria-hidden="true">✉</span> SMS
                      </a>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

export function UsefulContactsSection() {
  const [directory, setDirectory] = useState<"pompidou" | "gprmn" | null>(null);
  const [pompidouSection, setPompidouSection] = useState<PompidouSectionKey | null>(null);
  const activePompidouSection = POMPIDOU_CONTACT_SECTIONS.find(
    (section) => section.key === pompidouSection,
  );

  if (directory === "pompidou" && activePompidouSection) {
    return (
      <section className="useful-contacts-screen" aria-labelledby="contact-section-title">
        <header className="useful-contacts-subheader">
          <button type="button" onClick={() => setPompidouSection(null)} aria-label="Revenir aux contacts Pompidou">←</button>
          <div>
            <span className="step-label">Contacts Pompidou</span>
            <h2 id="contact-section-title">{activePompidouSection.title}</h2>
          </div>
        </header>
        {activePompidouSection.key === "ras" ? (
          <a
            className="useful-contact-group-email"
            href={mailComposeHref(activePompidouSection.contacts.flatMap((contact) => contact.email ? [contact.email] : []))}
            aria-label="Envoyer un e-mail à toute l’équipe des RAS"
          >
            <span aria-hidden="true">✉</span>
            <span>
              <strong>Envoyer un e-mail à toute l’équipe des RAS</strong>
              <small>10 destinataires déjà renseignés</small>
            </span>
          </a>
        ) : null}
        <ContactCards contacts={activePompidouSection.contacts} />
      </section>
    );
  }

  if (directory === "pompidou") {
    return (
      <section className="useful-contacts-screen" aria-labelledby="pompidou-contacts-title">
        <header className="useful-contacts-subheader">
          <button type="button" onClick={() => setDirectory(null)} aria-label="Revenir aux contacts utiles">←</button>
          <div>
            <span className="step-label">Contacts utiles</span>
            <h2 id="pompidou-contacts-title">Contacts Pompidou</h2>
          </div>
        </header>
        <div className="useful-contact-category-grid">
          {POMPIDOU_CONTACT_SECTIONS.map((section) => (
            <button type="button" key={section.key} onClick={() => setPompidouSection(section.key)}>
              <span><strong>{section.title}</strong><small>{section.contacts.length} contact{section.contacts.length > 1 ? "s" : ""}</small></span>
              <i aria-hidden="true">›</i>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (directory === "gprmn") {
    return (
      <section className="useful-contacts-screen" aria-labelledby="gprmn-contacts-title">
        <header className="useful-contacts-subheader">
          <button type="button" onClick={() => setDirectory(null)} aria-label="Revenir aux contacts utiles">←</button>
          <div>
            <span className="step-label">Contacts utiles</span>
            <h2 id="gprmn-contacts-title">Contact GP‑RMN</h2>
          </div>
        </header>
        <ContactCards contacts={GPRMN_CONTACTS} />
      </section>
    );
  }

  return (
    <section className="useful-contacts-screen" aria-labelledby="useful-contacts-title">
      <div className="native-screen-heading">
        <span className="step-label">Annuaire pratique</span>
        <h2 id="useful-contacts-title">Contacts utiles</h2>
        <p>Choisissez un annuaire pour retrouver rapidement le bon service.</p>
      </div>
      <div className="useful-contact-directory-grid">
        <button type="button" onClick={() => setDirectory("pompidou")}>
          <span aria-hidden="true">P</span>
          <span><strong>Contacts Pompidou</strong><small>RAS, administration, RH, médical, informatique et tickets restaurants</small></span>
          <i aria-hidden="true">›</i>
        </button>
        <button type="button" onClick={() => setDirectory("gprmn")}>
          <span aria-hidden="true">G</span>
          <span><strong>Contact GP‑RMN</strong><small>Accident, secourisme et supervision Expo</small></span>
          <i aria-hidden="true">›</i>
        </button>
      </div>
    </section>
  );
}
