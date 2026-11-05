import { describe, expect, it } from "vitest";
import { isNewestBuild, pageBusy, updateChoice } from "./appUpdate";

/** Une page réduite à ce que pageBusy regarde : le champ actif et une fenêtre ouverte. */
function page({ field, value = "", dialog = false }: { field?: string; value?: string; dialog?: boolean }) {
  const active = { matches: (selector: string) => Boolean(field) && selector.includes(field as string), value };
  let asked = "";
  return {
    activeElement: active as unknown as Element,
    querySelector: (selector: string) => {
      asked = selector;
      return dialog ? ({} as Element) : null;
    },
    asked: () => asked,
  };
}

describe("mise à jour de l'application installée", () => {
  it("adopte sans rien demander la version que la page porte déjà", () => {
    expect(updateChoice(true, true, false)).toBe("adopt");
    expect(updateChoice(true, false, true)).toBe("adopt");
  });

  it("à l'ouverture, recharge dans la dernière version si rien n'est en cours", () => {
    expect(updateChoice(false, true, false)).toBe("reload");
  });

  it("demande quand on se sert de l'application ou qu'une saisie est en cours", () => {
    expect(updateChoice(false, false, false)).toBe("ask");
    expect(updateChoice(false, true, true)).toBe("ask");
  });

  it("tient pour occupée une page avec un texte saisi ou une fenêtre ouverte", () => {
    expect(pageBusy(page({ field: "textarea", value: "Psy 11h45" }))).toBe(true);
    expect(pageBusy(page({ field: "input", value: "mika@" }))).toBe(true);
    expect(pageBusy(page({ dialog: true }))).toBe(true);
    // Un champ vide n'a rien à perdre, la fenêtre de mise à jour ne compte pas.
    expect(pageBusy(page({ field: "input" }))).toBe(false);
    const idle = page({});
    expect(pageBusy(idle)).toBe(false);
    expect(idle.asked()).toContain(":not(.update-available-modal");
  });

  it("reconnaît la version de la page dans le dernier cache créé", () => {
    const caches = ["planning-solo-a1b2c3d4e5f6", "demandes-a1b2c3d4e5f6", "planning-solo-0f9e8d7c6b5a"];
    // Le cache du formulaire autonome ne compte pas.
    expect(isNewestBuild(caches, "0f9e8d7c6b5a")).toBe(true);
    // La page laissée en arrière-plan porte l'ancienne version.
    expect(isNewestBuild(caches, "a1b2c3d4e5f6")).toBe(false);
    // Sans empreinte (version de développement), la page n'est jamais tenue pour à jour.
    expect(isNewestBuild(caches, undefined)).toBe(false);
    expect(isNewestBuild([], undefined)).toBe(false);
  });
});
