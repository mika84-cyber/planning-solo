import { useEffect, useState, type CSSProperties } from "react";
import "./resourceFolderList.css";
import { changeUsefulContact, getUsefulContacts } from "./contactsApi";
import { ContactEditDialog } from "./ContactEditDialog";
import type {
  PompidouContactSectionKey,
  UsefulContact,
  UsefulContactsPayload,
} from "./usefulContactsTypes";
import { matchesSearch } from "./searchMatching";
import "./usefulDocumentAdmin.css";
import { VISITOR_QR_LINKS, VisitorQrLinks } from "./VisitorQrLinks";

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

export function usefulContactId(contact: UsefulContact) {
  return [contact.context || "contact", contact.name, contact.email || "", ...(contact.phones?.map((phone) => phone.number) ?? [])].join("|").toLocaleLowerCase("fr");
}

function ContactCards({ contacts, isAdmin, onEdit }: { contacts: UsefulContact[]; isAdmin: boolean; onEdit: (contact: UsefulContact) => void }) {
  return (
    <div className="useful-contact-list">
      {contacts.map((contact) => (
        <article
          className={`useful-contact-card${contact.singleLineLabel ? " useful-contact-card-single-line-label" : ""}`}
          key={contact.id || `${contact.context || "contact"}-${contact.name}`}
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
          <div className="useful-contact-card-tools" role="group" aria-label={`Actions pour ${contact.name}`}>
            {isAdmin ? <button type="button" className="contact-admin-edit" aria-label={`Modifier ${contact.name}`} title="Modifier ce contact" onClick={() => onEdit(contact)}>✎</button> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

type UsefulContactsSectionProps = {
  initialData?: UsefulContactsPayload;
  accountId?: string;
  isAdmin?: boolean;
  demoMode?: boolean;
};

export function UsefulContactsSection({ initialData, isAdmin = false, demoMode = false }: UsefulContactsSectionProps) {
  const [directory, setDirectory] = useState<"pompidou" | "gprmn" | "visitors" | null>(null);
  const [pompidouSection, setPompidouSection] = useState<PompidouContactSectionKey | null>(null);
  const [contacts, setContacts] = useState<UsefulContactsPayload | null>(initialData || null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingContact, setEditingContact] = useState<UsefulContact | null>(null);
  const [addingContact, setAddingContact] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadAttempt est le déclencheur explicite du bouton Réessayer.
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
  const mutateContact = async (body: Record<string, unknown>) => {
    if (demoMode) {
      setContacts(current => {
        if (!current) return current;
        const next = structuredClone(current);
        if (body.action === "add") {
          const contact = { ...(body.contact as UsefulContact), id: `demo-${Date.now()}` };
          if (body.directory === "gprmn") next.gprmn.push(contact); else next.pompidou.find(section => section.key === body.section)?.contacts.push(contact);
        } else if (body.action === "update") {
          next.pompidou.forEach(section => { section.contacts = section.contacts.map(item => item.id === body.id ? body.contact as UsefulContact : item); });
          next.gprmn = next.gprmn.map(item => item.id === body.id ? body.contact as UsefulContact : item);
        } else {
          next.pompidou.forEach(section => { section.contacts = section.contacts.filter(item => item.id !== body.id); });
          next.gprmn = next.gprmn.filter(item => item.id !== body.id);
        }
        return next;
      });
      return;
    }
    setContacts(await changeUsefulContact(body));
  };
  const adminDialog = (directoryName: "pompidou" | "gprmn", section?: PompidouContactSectionKey) => <>
    {isAdmin ? <button type="button" className="contact-admin-add" onClick={() => setAddingContact(true)}>＋ Ajouter un contact</button> : null}
    {isAdmin && (addingContact || editingContact) ? <ContactEditDialog mode={addingContact ? "add" : "edit"} contact={editingContact || undefined} onClose={() => { setAddingContact(false); setEditingContact(null); }} onSave={contact => mutateContact(addingContact ? { action: "add", directory: directoryName, section, contact } : { action: "update", id: editingContact?.id, contact })} onDelete={editingContact ? () => mutateContact({ action: "delete", id: editingContact.id }) : undefined} /> : null}
  </>;
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
          <button className="section-back-hit-area" type="button" onClick={() => setPompidouSection(null)} aria-label="Revenir aux contacts Pompidou"><span className="section-back-arrow" aria-hidden="true">←</span></button>
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
        {adminDialog("pompidou", activePompidouSection.key)}
        <ContactCards contacts={activePompidouSection.contacts} isAdmin={isAdmin} onEdit={setEditingContact} />
      </section>
    );
  }

  if (directory === "pompidou") {
    return (
      <section className="useful-contacts-screen" aria-labelledby="pompidou-contacts-title">
        <header className="useful-contacts-subheader">
          <button className="section-back-hit-area" type="button" onClick={() => setDirectory(null)} aria-label="Revenir aux contacts utiles"><span className="section-back-arrow" aria-hidden="true">←</span></button>
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

  // Pour les visiteurs : les QR codes de réclamation et d'objet perdu, à
  // ouvrir ou à faire flasher.
  if (directory === "visitors") {
    return (
      <section className="useful-contacts-screen" aria-labelledby="visitor-contacts-title">
        <header className="useful-contacts-subheader">
          <button className="section-back-hit-area" type="button" onClick={() => setDirectory(null)} aria-label="Revenir aux contacts utiles"><span className="section-back-arrow" aria-hidden="true">←</span></button>
          <div><span className="step-label">Contacts utiles</span><h2 id="visitor-contacts-title">Pour les visiteurs</h2></div>
        </header>
        <VisitorQrLinks />
      </section>
    );
  }

  if (directory === "gprmn") {
    return (
      <section className="useful-contacts-screen" aria-labelledby="gprmn-contacts-title">
        <header className="useful-contacts-subheader">
          <button className="section-back-hit-area" type="button" onClick={() => setDirectory(null)} aria-label="Revenir aux contacts utiles"><span className="section-back-arrow" aria-hidden="true">←</span></button>
          <div><span className="step-label">Contacts utiles</span><h2 id="gprmn-contacts-title">Contact GP‑RMN</h2></div>
        </header>
        {adminDialog("gprmn")}
        <ContactCards contacts={contacts.gprmn} isAdmin={isAdmin} onEdit={setEditingContact} />
      </section>
    );
  }

  return (
    <section className="useful-contacts-screen useful-contacts-root" aria-labelledby="useful-contacts-title">
      <div className="native-screen-heading">
        <span className="step-label">Annuaire pratique</span>
        <h2 id="useful-contacts-title">Contacts utiles</h2>
        <p>Choisissez un annuaire pour retrouver les personnes, services et numéros utiles.</p>
      </div>
      <label className="resource-search-field"><span>Rechercher une personne ou un service</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nom ou service" /></label>
      <div className="resource-folder-stack">
      {searchQuery.trim() ? (
        <ContactCards
          contacts={[...contacts.pompidou.flatMap((section) => section.contacts), ...contacts.gprmn]
            .filter((contact) => matchesSearch(`${contact.name} ${contact.context || ""}`, searchQuery.trim()))}
          isAdmin={isAdmin}
          onEdit={setEditingContact}
        />
      ) : null}
      <div className="resource-folder-list">
          {([
            ["pompidou", "Contacts Pompidou", contacts?.pompidou.reduce((sum, section) => sum + section.contacts.length, 0), "RAS, RH, médical, informatique, tickets resto", "#3a5f8f"],
            ["gprmn", "Contact GP‑RMN", contacts?.gprmn.length, "Accident, secourisme, supervision Expo", "#2f7a52"],
            ["visitors", "Pour les visiteurs", VISITOR_QR_LINKS.length, "Réclamation et objet perdu, en QR code", "#a45f2d"],
          ] as const).map(([key, title, count, description, tone]) => (
            <button key={key} type="button" className={`resource-folder-row directory-${key}`} style={{ "--row-tone": tone } as CSSProperties} onClick={() => setDirectory(key)}>
              <span className="resource-folder-row-icon resource-folder-row-letter" aria-hidden="true">{key === "pompidou" ? "P" : key === "gprmn" ? "G" : "V"}</span>
              <span className="resource-folder-row-copy">
                <strong>{title}</strong>
                <small>{count ? `${count} ${key === "visitors" ? `QR code${count > 1 ? "s" : ""}` : `contact${count > 1 ? "s" : ""}`}` : description}</small>
              </span>
              <span className="resource-folder-row-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6" /></svg></span>
            </button>
          ))}
      </div>
      </div>
    </section>
  );
}
