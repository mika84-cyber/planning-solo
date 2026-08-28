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
