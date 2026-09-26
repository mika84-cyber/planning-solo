import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { INSTALL_NOTICE_DISMISSED_KEY, InstallAppNotice } from "./InstallAppNotice";

function simuler({ dismissed = false }: { dismissed?: boolean } = {}) {
  const valeurs = new Map<string, string>();
  if (dismissed) valeurs.set(INSTALL_NOTICE_DISMISSED_KEY, "1");
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => valeurs.get(k) ?? null,
    setItem: (k: string, v: string) => void valeurs.set(k, v),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("bandeau d’installation pour les invités", () => {
  it("propose d’installer l’application d’un geste quand le navigateur le permet", () => {
    simuler();
    const html = renderToStaticMarkup(<InstallAppNotice available onInstall={() => undefined} />);
    expect(html).toContain("Installer l’application sur votre téléphone ou ordinateur");
    expect(html).toContain(">Installer</button>");
    expect(html).toContain("Plus tard");
  });

  it("reste muet quand l’installation n’est pas possible ou déjà faite", () => {
    simuler();
    expect(renderToStaticMarkup(<InstallAppNotice available={false} onInstall={() => undefined} />)).toBe("");
  });

  it("ne revient pas une fois écarté", () => {
    simuler({ dismissed: true });
    expect(renderToStaticMarkup(<InstallAppNotice available onInstall={() => undefined} />)).toBe("");
  });
});
