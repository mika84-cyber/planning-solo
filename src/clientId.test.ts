import { describe, expect, it } from "vitest";
import { createClientId } from "./clientId";

describe("identifiants compatibles avec la démo téléphone", () => {
  it("utilise randomUUID lorsqu'il est disponible", () => {
    expect(createClientId("overtime", () => "uuid-fiable")).toBe(
      "uuid-fiable",
    );
  });

  it("fournit un identifiant serveur valide sans API Web Crypto", () => {
    const id = createClientId("overtime", null);
    expect(id).toMatch(/^[a-zA-Z0-9-]{8,80}$/);
  });
});
