import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({
  refreshSession: vi.fn<() => Promise<string | null>>(),
  onAuthChange: vi.fn(),
}));
vi.mock("@netlify/identity", () => identity);

import {
  forgetRememberedSession,
  forgetSessionAtNewLaunch,
  installSessionRenewal,
  keepSessionBackup,
  markSessionLaunch,
  readCalendarSnapshot,
  rememberSessionEnabled,
  renewSession,
  restoreRememberedSession,
  saveCalendarSnapshot,
  saveSnapshotAdmin,
  setRememberSession,
} from "./rememberedSession";

let written: string[] = [];
let jar = "";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  } as Storage;
}

function session(access: string, refresh: string, id = "u-1") {
  return JSON.stringify({ id, url: "https://planning.test/.netlify/identity", token: { access_token: access, refresh_token: refresh } });
}

beforeEach(() => {
  identity.refreshSession.mockReset().mockResolvedValue(null);
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  written = [];
  jar = "";
  globalThis.document = {
    get cookie() { return jar; },
    set cookie(value: string) { written.push(value); },
  } as Document;
  localStorage.setItem("gotrue.user", session("a.b.c", "r1"));
});

describe("rester connecté", () => {
  it("est proposé par défaut et se retient", () => {
    expect(rememberSessionEnabled()).toBe(true);
    setRememberSession(false);
    expect(rememberSessionEnabled()).toBe(false);
  });

  it("recrée le cookie effacé à la fermeture depuis la session gardée", () => {
    expect(restoreRememberedSession()).toBe(true);
    expect(written[0]).toMatch(/^nf_jwt=a\.b\.c; path=\/; secure; samesite=lax$/);
    expect(written[1]).toMatch(/^nf_refresh=r1;/);
  });

  it("ne fait rien sans le choix, avec le cookie déjà à jour ou sans session", () => {
    setRememberSession(false);
    expect(restoreRememberedSession()).toBe(false);
    setRememberSession(true);
    jar = "nf_jwt=a.b.c";
    expect(restoreRememberedSession()).toBe(false);
    jar = "";
    localStorage.removeItem("gotrue.user");
    expect(restoreRememberedSession()).toBe(false);
    expect(written).toEqual([]);
  });

  it("remet la session effacée par un renouvellement manqué depuis la copie de secours", () => {
    keepSessionBackup();
    // La bibliothèque efface la session gardée quand le réseau manque.
    localStorage.removeItem("gotrue.user");
    expect(restoreRememberedSession()).toBe(true);
    expect(localStorage.getItem("gotrue.user")).toBe(session("a.b.c", "r1"));
    expect(written[0]).toMatch(/^nf_jwt=a\.b\.c;/);
  });

  it("n'a plus de copie de secours après une déconnexion ou sans le choix", () => {
    keepSessionBackup();
    forgetRememberedSession();
    localStorage.removeItem("gotrue.user");
    expect(restoreRememberedSession()).toBe(false);

    localStorage.setItem("gotrue.user", session("a.b.c", "r1"));
    keepSessionBackup();
    setRememberSession(false);
    setRememberSession(true);
    localStorage.removeItem("gotrue.user");
    expect(restoreRememberedSession()).toBe(false);
  });
});

describe("sans « Rester connecté »", () => {
  it("une nouvelle ouverture oublie la session, pas un rechargement", () => {
    setRememberSession(false);
    jar = "nf_jwt=a.b.c; nf_refresh=r1";
    markSessionLaunch();
    expect(forgetSessionAtNewLaunch()).toBe(false);
    expect(localStorage.getItem("gotrue.user")).not.toBeNull();

    globalThis.sessionStorage = storage();
    expect(forgetSessionAtNewLaunch()).toBe(true);
    expect(localStorage.getItem("gotrue.user")).toBeNull();
    expect(written).toEqual([
      expect.stringMatching(/^nf_jwt=; .*expires=Thu, 01 Jan 1970/),
      expect.stringMatching(/^nf_refresh=; .*expires=Thu, 01 Jan 1970/),
    ]);
  });

  it("ne touche à rien quand la personne reste connectée", () => {
    expect(forgetSessionAtNewLaunch()).toBe(false);
    expect(localStorage.getItem("gotrue.user")).not.toBeNull();
    expect(written).toEqual([]);
  });
});

describe("renouvellement de la session", () => {
  it("renouvelle le jeton expiré, met les cookies et la copie à jour", async () => {
    jar = "nf_jwt=a.b.c";
    identity.refreshSession.mockImplementation(async () => {
      localStorage.setItem("gotrue.user", session("d.e.f", "r2"));
      jar = "nf_jwt=d.e.f";
      return "d.e.f";
    });
    await expect(renewSession()).resolves.toBe(true);
    expect(identity.refreshSession).toHaveBeenCalledTimes(1);
    // La copie de secours suit le nouveau jeton de renouvellement.
    localStorage.removeItem("gotrue.user");
    restoreRememberedSession();
    expect(localStorage.getItem("gotrue.user")).toBe(session("d.e.f", "r2"));
  });

  it("partage un seul renouvellement entre des appels simultanés", async () => {
    jar = "nf_jwt=a.b.c";
    await Promise.all([renewSession(), renewSession(), renewSession()]);
    expect(identity.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("garde la copie de secours quand le renouvellement échoue", async () => {
    keepSessionBackup();
    jar = "nf_jwt=a.b.c";
    identity.refreshSession.mockImplementation(async () => {
      localStorage.removeItem("gotrue.user");
      return null;
    });
    await expect(renewSession()).resolves.toBe(false);
    // La tentative suivante, réseau revenu, repart de la copie.
    identity.refreshSession.mockResolvedValue(null);
    await expect(renewSession()).resolves.toBe(true);
    expect(localStorage.getItem("gotrue.user")).toBe(session("a.b.c", "r1"));
  });

  it("répond non sans session gardée", async () => {
    localStorage.removeItem("gotrue.user");
    await expect(renewSession()).resolves.toBe(false);
    expect(identity.refreshSession).not.toHaveBeenCalled();
  });
});

describe("appels refusés pour « connexion requise »", () => {
  it("renouvelle la session et rejoue une fois l'appel à /api", async () => {
    const answers = [401, 200, 401];
    const fetchMock = vi.fn(async () => new Response(null, { status: answers.shift() ?? 200 }));
    globalThis.window = { fetch: fetchMock } as unknown as Window & typeof globalThis;
    globalThis.location = { href: "https://planning.test/", origin: "https://planning.test" } as Location;
    jar = "nf_jwt=a.b.c";
    installSessionRenewal();

    const init = { method: "POST", body: "{}" };
    const saved = await window.fetch("/api/calendar", init);
    expect(saved.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/calendar", init);
    expect(identity.refreshSession).toHaveBeenCalledTimes(1);

    // Les autres adresses ne sont pas rejouées.
    const other = await window.fetch("/.netlify/identity/user");
    expect(other.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("ouverture immédiate", () => {
  it("garde le dernier planning du compte connecté, avec son rôle", () => {
    expect(readCalendarSnapshot()).toBeNull();
    saveCalendarSnapshot({ entries: { "2026-09-27": { noteText: "Colis" } } });
    saveSnapshotAdmin(true);
    expect(readCalendarSnapshot()).toEqual({ data: { entries: { "2026-09-27": { noteText: "Colis" } } }, isAdmin: true });
    // Un nouveau planning garde le rôle déjà connu.
    saveCalendarSnapshot({ entries: {} });
    expect(readCalendarSnapshot()).toEqual({ data: { entries: {} }, isAdmin: true });
  });

  it("ne montre jamais le planning d'un autre compte", () => {
    saveCalendarSnapshot({ entries: {} });
    localStorage.setItem("gotrue.user", session("x.y.z", "r9", "u-2"));
    expect(readCalendarSnapshot()).toBeNull();
  });

  it("n'est rien gardé sans « Rester connecté », et tout s'efface à la déconnexion", () => {
    saveCalendarSnapshot({ entries: {} });
    forgetRememberedSession();
    expect(readCalendarSnapshot()).toBeNull();

    saveCalendarSnapshot({ entries: {} });
    setRememberSession(false);
    saveCalendarSnapshot({ entries: {} });
    setRememberSession(true);
    expect(readCalendarSnapshot()).toBeNull();
  });
});
