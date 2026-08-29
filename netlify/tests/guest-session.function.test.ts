import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@netlify/identity", () => ({ getUser: vi.fn() }));
vi.mock("../lib/guestLoginAlert.mts", () => ({ sendGuestLoginAlertOnce: vi.fn() }));

import { getUser } from "@netlify/identity";
import guestSessionHandler, { config } from "../functions/guest-session.mts";
import { sendGuestLoginAlertOnce } from "../lib/guestLoginAlert.mts";

const mockedGetUser = vi.mocked(getUser);
const mockedAlert = vi.mocked(sendGuestLoginAlertOnce);
const postRequest = (origin?: string) => new Request(
  "https://planning.example.test/api/guest-session",
  { method: "POST", headers: origin ? { origin } : undefined },
);

describe("signalement d'une session invitée", () => {
  beforeEach(() => {
    mockedGetUser.mockReset();
    mockedAlert.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("refuse les méthodes autres que POST", async () => {
    const response = await guestSessionHandler(
      new Request("https://planning.example.test/api/guest-session"),
    );
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "Méthode non autorisée" });
    expect(mockedGetUser).not.toHaveBeenCalled();
  });

  it("refuse une mutation provenant d'un autre site", async () => {
    const response = await guestSessionHandler(postRequest("https://attacker.test"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Origine de la requête non autorisée" });
    expect(mockedGetUser).not.toHaveBeenCalled();
  });

  it("refuse aussi un en-tête Origin mal formé", async () => {
    const response = await guestSessionHandler(postRequest("origine-invalide"));
    expect(response.status).toBe(403);
    expect(mockedGetUser).not.toHaveBeenCalled();
  });

  it("exige un compte complet et authentifié", async () => {
    mockedGetUser.mockResolvedValue(null);
    const response = await guestSessionHandler(postRequest());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Connexion requise" });
    expect(mockedAlert).not.toHaveBeenCalled();
  });

  it("refuse un compte sans adresse e-mail", async () => {
    mockedGetUser.mockResolvedValue({ id: "guest-incomplet", email: "" } as never);
    const response = await guestSessionHandler(postRequest());
    expect(response.status).toBe(401);
    expect(mockedAlert).not.toHaveBeenCalled();
  });

  it("envoie l'alerte une fois et interdit la mise en cache", async () => {
    mockedGetUser.mockResolvedValue({ id: "guest-1", email: "guest@example.test" } as never);
    mockedAlert.mockResolvedValue("sent");
    const response = await guestSessionHandler(postRequest("https://planning.example.test"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ ok: true, status: "sent" });
    expect(mockedAlert).toHaveBeenCalledWith("guest-1", "guest@example.test");
    expect(config).toEqual({ path: "/api/guest-session" });
  });

  it("autorise la session même si l'alerte administrateur échoue", async () => {
    mockedGetUser.mockResolvedValue({ id: "guest-2", email: "guest2@example.test" } as never);
    mockedAlert.mockRejectedValue(new Error("Configuration absente"));
    const response = await guestSessionHandler(postRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "unavailable" });
    expect(console.warn).toHaveBeenCalled();
  });

  it("normalise une erreur d'alerte non standard", async () => {
    mockedGetUser.mockResolvedValue({ id: "guest-3", email: "guest3@example.test" } as never);
    mockedAlert.mockRejectedValue("hors ligne");
    const response = await guestSessionHandler(postRequest());
    expect(await response.json()).toEqual({ ok: true, status: "unavailable" });
    expect(console.warn).toHaveBeenCalledWith(
      "Planning Solo: session autorisée mais alerte administrateur indisponible",
      "hors ligne",
    );
  });
});
