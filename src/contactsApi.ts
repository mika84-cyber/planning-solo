import type { UsefulContactsPayload } from "./usefulContactsTypes";

export class ContactsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ContactsApiError";
  }
}

export async function getUsefulContacts() {
  const response = await fetch("/api/contacts", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => null)) as
    | (UsefulContactsPayload & { error?: string })
    | null;
  if (!response.ok)
    throw new ContactsApiError(
      payload?.error || "L’annuaire n’a pas pu être chargé.",
      response.status,
    );
  if (!payload?.pompidou || !Array.isArray(payload.gprmn))
    throw new ContactsApiError("L’annuaire reçu est incomplet.", 502);
  return payload;
}

export async function changeUsefulContact(body: Record<string, unknown>) {
  const response = await fetch("/api/contacts", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null) as (UsefulContactsPayload & { error?: string }) | null;
  if (!response.ok || !payload) throw new ContactsApiError(payload?.error || "La modification du contact a échoué.", response.status);
  return payload;
}
