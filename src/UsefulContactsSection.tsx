import { useEffect, useMemo, useState } from "react";
import { getUsefulContacts } from "./contactsApi";
import type {
  PompidouContactSectionKey,
  UsefulContact,
  UsefulContactsPayload,
} from "./usefulContactsTypes";

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

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function ContactCards({ contacts }: { contacts: UsefulContact[] }) {
  return (
    <div className="useful-contact-list">
      {contacts.map((contact) => (
        <article
          className={`useful-contact-card${contact.singleLineLabel ? " useful-contact-card-single-line-label" : ""}`}
          key={`${contact.context || "contact"}-${contact.name}`}
        >
          <div className="useful-contact-identity">
            <span aria-hidden="true">{contactInitials(contact.name)}</span>
            <span>
              <strong>{contact.name}</strong>
              {contact.context ? <small>{contact.context}</small> : null}
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
                <div
                  className={`useful-contact-phone${mobile ? " mobile" : " fixed"}`}
                  key={`${contact.name}-${phone.number}`}
                >
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

type UsefulContactsSectionProps = {
  initialData?: UsefulContactsPayload;
};

export function UsefulContactsSection({ initialData }: UsefulContactsSectionProps) {
  const [directory, setDirectory] = useState<"pompidou" | "gprmn" | null>(null);
  const [pompidouSection, setPompidouSection] = useState<PompidouContactSectionKey | null>(null);
  const [contacts, setContacts] = useState<UsefulContactsPayload | null>(initialData || null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (initialData) return;
    let active = true;
    setLoadError("");
    void getUsefulContacts()
      .then((payload) => {
        if (active) setContacts(payload);
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "L’annuaire n’a pas pu être chargé.",
          );
      });
    return () => {
      active = false;
    };
  }, [initialData, loadAttempt]);

  const activePompidouSection = contacts?.pompidou.find(
    (section) => section.key === pompidouSection,
  );
  const searchResults = useMemo(() => {
    if (!contacts || !query.trim()) return [];
    const needle = searchable(query.trim());
    return [
      ...contacts.pompidou.flatMap((section) =>
        section.contacts.map((contact) => ({
          ...contact,
          context: `Contacts Pompidou · ${section.title}`,
        })),
      ),
      ...contacts.gprmn.map((contact) => ({
        ...contact,
        context: "Contact GP‑RMN",
      })),
    ].filter((contact) =>
      searchable(
        [
          contact.name,
          contact.context,
          contact.email || "",
          ...(contact.phones || []).map((phone) => phone.number),
        ].join(" "),
      ).includes(needle),
    );
  }, [contacts, query]);

  if (!contacts) {
    return (
      <section className="useful-contacts-screen" aria-labelledby="useful-contacts-title">
        <div className="native-screen-heading">
          <span className="step-label">Annuaire sécurisé</span>
          <h2 id="useful-contacts-title">Contacts utiles</h2>
          <p>Les coordonnées sont chargées uniquement après votre connexion.</p>
        </div>
        {loadError ? (
          <div className="useful-contact-load-state error" role="alert">
            <strong>Impossible de charger les contacts</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>Réessayer</button>
          </div>
        ) : (
          <div className="useful-contact-load-state" role="status">
            <span aria-hidden="true">•••</span>
            <strong>Chargement de l’annuaire sécurisé…</strong>
          </div>
        )}
      </section>
    );
  }

  if (directory === "pompidou" && activePompidouSection) {
    return (
      <section className="useful-contacts-screen" aria-labelledby="contact-section-title">
        <header className="useful-contacts-subheader">
          <button type="button" onClick={() => setPompidouSection(null)} aria-label="Revenir aux contacts Pompidou">←</button>
          <div><span className="step-label">Contacts Pompidou</span><h2 id="contact-section-title">{activePompidouSection.title}</h2></div>
        </header>
        {activePompidouSection.key === "ras" ? (
          <a
            className="useful-contact-group-email"
            href={mailComposeHref(activePompidouSection.contacts.flatMap((contact) => contact.email ? [contact.email] : []))}
            aria-label="Envoyer un e-mail à toute l’équipe des RAS"
          >
            <span aria-hidden="true">✉</span>
            <span><strong>Envoyer un e-mail à toute l’équipe des RAS</strong><small>{activePompidouSection.contacts.length} destinataires déjà renseignés</small></span>
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
          <div><span className="step-label">Contacts utiles</span><h2 id="pompidou-contacts-title">Contacts Pompidou</h2></div>
        </header>
        <div className="useful-contact-category-grid">
          {contacts.pompidou.map((section) => (
            <button type="button" key={section.key} onClick={() => setPompidouSection(section.key)}>
              <span><strong>{section.title}</strong><small>{section.contacts.length} contact{section.contacts.length > 1 ? "s" : ""}</small></span><i aria-hidden="true">›</i>
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
          <div><span className="step-label">Contacts utiles</span><h2 id="gprmn-contacts-title">Contact GP‑RMN</h2></div>
        </header>
        <ContactCards contacts={contacts.gprmn} />
      </section>
    );
  }

  return (
    <section className="useful-contacts-screen useful-contacts-root" aria-labelledby="useful-contacts-title">
      <div className="native-screen-heading">
        <span className="step-label">Annuaire pratique</span>
        <h2 id="useful-contacts-title">Contacts utiles</h2>
        <p>Choisissez un annuaire ou recherchez directement une personne, un service ou un numéro.</p>
      </div>
      <label className="useful-resource-search">
        <span>Rechercher dans les contacts</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, service, e-mail ou téléphone…" />
      </label>
      {query.trim() ? (
        <div className="useful-contact-search-results" aria-live="polite">
          <p>{searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}</p>
          {searchResults.length ? <ContactCards contacts={searchResults} /> : <div className="useful-resource-empty-search">Aucun contact ne correspond à votre recherche.</div>}
        </div>
      ) : (
        <div className="useful-contact-directory-grid">
          <button type="button" onClick={() => setDirectory("pompidou")}>
            <span aria-hidden="true">P</span><span><strong>Contacts Pompidou</strong><small>RAS, administration, RH, médical, informatique et tickets restaurants</small></span><i aria-hidden="true">›</i>
          </button>
          <button type="button" onClick={() => setDirectory("gprmn")}>
            <span aria-hidden="true">G</span><span><strong>Contact GP‑RMN</strong><small>Accident, secourisme et supervision Expo</small></span><i aria-hidden="true">›</i>
          </button>
        </div>
      )}
    </section>
  );
}
