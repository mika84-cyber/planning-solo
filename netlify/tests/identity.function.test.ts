import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/guestLoginAlert.mts", () => ({ sendGuestLoginAlertOnce: vi.fn() }));

import identityEvents, { config } from "../functions/identity.mts";
import { sendGuestLoginAlertOnce } from "../lib/guestLoginAlert.mts";

const mockedAlert = vi.mocked(sendGuestLoginAlertOnce);
const loginEvent = {
  user: { id: "guest-1", email: "guest@example.test" },
};

describe("événement Identity de connexion", () => {
  beforeEach(() => {
    mockedAlert.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("traite une connexion en arrière-plan", async () => {
    mockedAlert.mockResolvedValue("throttled");
    await expect(identityEvents.userLogin(loginEvent as never)).resolves.toBeUndefined();
    expect(mockedAlert).toHaveBeenCalledWith("guest-1", "guest@example.test");
    expect(console.info).toHaveBeenCalledWith(
      "Planning Solo: événement de connexion traité",
      "throttled",
    );
    expect(config).toEqual({ background: true });
  });

  it("ne bloque pas la connexion si l'alerte échoue", async () => {
    mockedAlert.mockRejectedValue(new Error("Resend indisponible"));
    await expect(identityEvents.userLogin(loginEvent as never)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "Planning Solo: connexion autorisée mais alerte administrateur indisponible",
      "Resend indisponible",
    );
  });

  it("journalise aussi une erreur non standard sans la relancer", async () => {
    mockedAlert.mockRejectedValue("erreur brute");
    await expect(identityEvents.userLogin(loginEvent as never)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "Planning Solo: connexion autorisée mais alerte administrateur indisponible",
      "erreur brute",
    );
  });
});
