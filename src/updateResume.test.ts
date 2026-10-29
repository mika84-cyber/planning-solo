import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Le module garde sa première lecture : chaque cas le recharge. */
async function load() {
  vi.resetModules();
  return import("./updateResume");
}

describe("reprise après une mise à jour", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    vi.stubGlobal("history", { state: { planningSection: "pay", payScreen: "payslip" } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("note la rubrique et le sous-écran, les rend une fois, puis les oublie", async () => {
    const before = await load();
    before.rememberScreenBeforeUpdate();
    expect(store.has("planning:resume-after-update")).toBe(true);
    const after = await load();
    expect(after.resumedScreen()).toMatchObject({ section: "pay", payScreen: "payslip" });
    // Le stockage est vidé ; la réponse reste la même pour tous dans ce lancement.
    expect(store.has("planning:resume-after-update")).toBe(false);
    expect(after.resumedScreen()).toMatchObject({ section: "pay" });
    const later = await load();
    expect(later.resumedScreen()).toBeNull();
  });

  it("ignore un repère vieux de plus d’une minute, ou illisible", async () => {
    store.set("planning:resume-after-update", JSON.stringify({ section: "pay", at: Date.now() - 61_000 }));
    expect((await load()).resumedScreen()).toBeNull();
    store.set("planning:resume-after-update", "{pas du json");
    expect((await load()).resumedScreen()).toBeNull();
  });
});
