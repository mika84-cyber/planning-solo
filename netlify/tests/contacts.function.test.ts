import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@netlify/identity", () => ({ getUser: vi.fn() }));
const stored = new Map<string, unknown>();
const store = { get: vi.fn(async (key: string) => stored.get(key) ?? null), setJSON: vi.fn(async (key: string, value: unknown) => { stored.set(key, value); }) };
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));

import { getUser } from "@netlify/identity";
import contactsHandler from "../functions/contacts.mts";

const mockedGetUser = vi.mocked(getUser);

describe("fonction sécurisée des contacts", () => {
  beforeEach(() => {
    mockedGetUser.mockReset();
    stored.clear();
    vi.clearAllMocks();
    (globalThis as typeof globalThis & { Netlify?: unknown }).Netlify = { env: { get: (name: string) => name === "PROGRAM_ADMIN_EMAIL" ? "admin@example.test" : undefined } };
  });

  it("refuse l’annuaire sans utilisateur authentifié", async () => {
    mockedGetUser.mockResolvedValue(null);
    const response = await contactsHandler(new Request("https://example.test/api/contacts"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Connexion requise" });
  });

  it("réserve l’ajout, la modification et la suppression au compte administrateur", async () => {
    mockedGetUser.mockResolvedValue({ id: "guest", email: "guest@example.test" } as never);
    const guest = await contactsHandler(new Request("https://example.test/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id: "gprmn-0" }) }));
    expect(guest.status).toBe(403);

    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const post = (body: unknown) => contactsHandler(new Request("https://example.test/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    const added = await (await post({ action: "add", directory: "pompidou", section: "administration", contact: { name: "Contact ajouté", email: "contact@example.test", phones: [{ number: "0612345678" }] } })).json();
    const created = added.pompidou.find((section: { key: string }) => section.key === "administration").contacts.at(-1);
    expect(created).toMatchObject({ name: "Contact ajouté", email: "contact@example.test" });
    const updated = await (await post({ action: "update", id: created.id, contact: { name: "Contact corrigé", email: "contact@example.test" } })).json();
    expect(updated.pompidou.flatMap((section: { contacts: unknown[] }) => section.contacts)).toContainEqual(expect.objectContaining({ id: created.id, name: "Contact corrigé" }));
    expect((await post({ action: "delete", id: created.id })).status).toBe(200);
  });

  it("renvoie les contacts sans cache après authentification", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-1", email: "test@example.test" } as never);
    const response = await contactsHandler(new Request("https://example.test/api/contacts"));
    const payload = await response.json() as { pompidou: unknown[]; gprmn: unknown[] };
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(payload.pompidou).toHaveLength(6);
    expect(payload.gprmn).toHaveLength(13);
  });

  it("envoie les codes radio aux comptes connectés sans jamais les enregistrer", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-1", email: "test@example.test" } as never);
    const payload = await (await contactsHandler(new Request("https://example.test/api/contacts"))).json() as { radioCodes: { code: string; meaning: string }[] };
    expect(payload.radioCodes.map((item) => item.code)).toEqual(["FOX", "TANGO", "VICTOR", "BRAVO", "CHARLIE", "MIKE", "EXGO", "CODE 22", "CODE 17", "SIERRA"]);
    expect(payload.radioCodes[0]).toEqual({ code: "FOX", meaning: "Alerte Feu" });

    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const answer = await (await contactsHandler(new Request("https://example.test/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", directory: "gprmn", contact: { name: "Nouveau", email: "nouveau@example.test" } }) }))).json();
    expect(answer.radioCodes).toHaveLength(10);
    expect(stored.get("useful-contacts/admin-directory")).not.toHaveProperty("radioCodes");
  });

  it("garde le SMS désactivé d’un numéro conservé lors d’une modification", async () => {
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const initial = await (await contactsHandler(new Request("https://example.test/api/contacts"))).json() as { gprmn: { id: string; name: string }[] };
    const supervisor = initial.gprmn.find((contact) => contact.name === "Superviseur PC")!;
    const answer = await (await contactsHandler(new Request("https://example.test/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "update", id: supervisor.id, contact: { name: "Superviseur PC", phones: [{ number: "0611793883" }, { number: "0144131724" }] } }),
    }))).json() as { gprmn: { id: string; phones?: { number: string; allowSms?: boolean }[] }[] };
    expect(answer.gprmn.find((contact) => contact.id === supervisor.id)?.phones).toEqual([
      { number: "0611793883", allowSms: false },
      { number: "0144131724" },
    ]);
  });

  it("garde le canal radio, la précision et le thème d’un contact modifié depuis l’application", async () => {
    // La fenêtre de modification n'envoie que le nom, l'e-mail et les numéros.
    mockedGetUser.mockResolvedValue({ id: "admin", email: "admin@example.test" } as never);
    const answer = await (await contactsHandler(new Request("https://example.test/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "update", id: "gprmn-0", contact: { name: "Sûreté", phones: [{ number: "01 44 13 17 50" }] } }),
    }))).json() as { gprmn: { id: string; name: string; radioChannel?: number; context?: string; theme?: string }[] };
    expect(answer.gprmn[0]).toMatchObject({ id: "gprmn-0", name: "Sûreté", radioChannel: 2, context: "Malveillance, altercation", theme: "Urgences" });
  });
});
