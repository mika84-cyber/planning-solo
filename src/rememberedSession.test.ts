import { beforeEach, describe, expect, it } from "vitest";
import { rememberSessionEnabled, restoreRememberedSession, setRememberSession } from "./rememberedSession";

let written: string[] = [];
let jar = "";

beforeEach(() => {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  } as Storage;
  written = [];
  jar = "";
  globalThis.document = {
    get cookie() { return jar; },
    set cookie(value: string) { written.push(value); },
  } as Document;
  localStorage.setItem("gotrue.user", JSON.stringify({ token: { access_token: "a.b.c", refresh_token: "r1" } }));
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

  it("ne fait rien sans le choix, avec un cookie encore là ou sans session", () => {
    setRememberSession(false);
    expect(restoreRememberedSession()).toBe(false);
    setRememberSession(true);
    jar = "nf_jwt=x";
    expect(restoreRememberedSession()).toBe(false);
    jar = "";
    localStorage.removeItem("gotrue.user");
    expect(restoreRememberedSession()).toBe(false);
    expect(written).toEqual([]);
  });
});
