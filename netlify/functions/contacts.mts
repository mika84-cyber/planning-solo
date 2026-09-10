import { getUser } from "@netlify/identity";
import { getStore } from "@netlify/blobs";
import { USEFUL_CONTACTS_DATA } from "../lib/usefulContactsData.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { archive } from '../lib/adminTools.mts';
import type { UsefulContact, UsefulContactsPayload } from "../../src/usefulContactsTypes.ts";

const directoryKey = "useful-contacts/admin-directory";
const normalizedEmail = (value?: string) => (value || "").trim().toLocaleLowerCase("fr");
function configuredAdminEmail() {
  return (globalThis as typeof globalThis & { Netlify?: { env?: { get(name: string): string | undefined } } }).Netlify?.env?.get("PROGRAM_ADMIN_EMAIL");
}
function baseline(): UsefulContactsPayload {
  return {
    pompidou: USEFUL_CONTACTS_DATA.pompidou.map(section => ({ ...section, contacts: section.contacts.map((contact, index) => ({ ...contact, id: `pompidou-${section.key}-${index}` })) })),
    gprmn: USEFUL_CONTACTS_DATA.gprmn.map((contact, index) => ({ ...contact, id: `gprmn-${index}` })),
  };
}
function parseContact(value: unknown, id?: string): UsefulContact | null {
  const source = value as Partial<UsefulContact> | null;
  const name = typeof source?.name === "string" ? source.name.replace(/\s+/g, " ").trim().slice(0, 100) : "";
  const email = typeof source?.email === "string" ? source.email.trim().slice(0, 160) : "";
  const phones = Array.isArray(source?.phones) ? source.phones.map(phone => ({ label: typeof phone.label === "string" ? phone.label.trim().slice(0, 30) : undefined, number: String(phone.number || "").replace(/\D/g, "").slice(0, 15) })).filter(phone => phone.number.length >= 10) : [];
  if (name.length < 2 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (!email && !phones.length)) return null;
  return { id, name, ...(email ? { email } : {}), ...(phones.length ? { phones } : {}) };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
    },
  });
}

async function contactsHandler(request: Request): Promise<Response> {
  if (!isTrustedMutation(request)) return json({ error: "Requête refusée" }, 403);
  const user = await getUser();
  if (!user?.id || !user.email)
    return json({ error: "Connexion requise" }, 401);
  const store = getStore({ name: "planning-solo", consistency: "strong" });
  let directory = await store.get(directoryKey, { type: "json" }) as UsefulContactsPayload | null;
  directory ||= baseline();
  if (request.method === "GET") return json(directory);
  if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (normalizedEmail(user.email) !== normalizedEmail(configuredAdminEmail())) return json({ error: "Modification réservée au compte administrateur" }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !["add", "update", "delete"].includes(String(body.action))) return json({ error: "Action invalide" }, 400);
  const all = [...directory.pompidou.flatMap(section => section.contacts), ...directory.gprmn];
  const id = typeof body.id === "string" ? body.id : "";
  if (body.action === "add") {
    const contact = parseContact(body.contact, crypto.randomUUID());
    if (!contact) return json({ error: "Renseignez un nom et au moins un e-mail ou téléphone valide" }, 400);
    if (body.directory === "gprmn") directory.gprmn.push(contact);
    else {
      const section = directory.pompidou.find(item => item.key === body.section);
      if (!section) return json({ error: "Rubrique invalide" }, 400);
      section.contacts.push(contact);
    }
  } else {
    if (!id || !all.some(contact => contact.id === id)) return json({ error: "Contact introuvable" }, 404);
    if (body.action === "update") {
      const contact = parseContact(body.contact, id);
      if (!contact) return json({ error: "Coordonnées invalides" }, 400);
      directory.pompidou.forEach(section => { section.contacts = section.contacts.map(item => item.id === id ? contact : item); });
      directory.gprmn = directory.gprmn.map(item => item.id === id ? contact : item);
    } else {
      const contact = all.find(item => item.id === id)!;
      const section = directory.pompidou.find(item => item.contacts.some(person => person.id === id));
      await archive(store, { kind: 'contact', title: contact.name, entries: [{ key: directoryKey, value: { contact, section: section?.key } }] });
      directory.pompidou.forEach(section => { section.contacts = section.contacts.filter(item => item.id !== id); });
      directory.gprmn = directory.gprmn.filter(item => item.id !== id);
    }
  }
  await store.setJSON(directoryKey, directory);
  return json(directory);
}

export default contactsHandler;
export const config = { path: "/api/contacts" };
