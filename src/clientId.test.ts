import { describe, expect, it } from "vitest";
import { createClientId } from "./clientId";

describe("identifiants compatibles avec la démo téléphone", () => {
  it("conserve le préfixe quand randomUUID est disponible", () => {
    expect(createClientId("overtime", () => "uuid-fiable")).toBe(
      "overtime-uuid-fiable",
    );
  });

  it("identifie toujours un ajout manuel de solde, y compris en HTTPS", () => {
    expect(createClientId("solidarity", () => "uuid-fiable")).toBe(
      "solidarity-uuid-fiable",
    );
  });

  it("fournit un identifiant serveur valide sans API Web Crypto", () => {
    const id = createClientId("overtime", null);
    expect(id).toMatch(/^[a-zA-Z0-9-]{8,80}$/);
  });
});
