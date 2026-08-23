import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CetFormDialog } from "./CetFormDialog";

const common = {
  fullName: "Agnès Martin",
  signature: "",
  year: 2026,
  annualBalance: 11,
  rttBalance: 15,
  depositDays: 10,
  balanceBefore: 18,
  onClose: vi.fn(),
};

describe("formulaires CET", () => {
  it.each(["opening", "funding"] as const)(
    "propose une signature directement dans le formulaire %s",
    (kind) => {
      const html = renderToStaticMarkup(<CetFormDialog {...common} kind={kind} />);
      expect(html).toContain("Signature de l’agent");
      expect(html).toContain('aria-label="Zone de signature"');
      expect(html).toContain("Effacer la signature");
      expect(html).toContain("Télécharger le formulaire rempli");
    },
  );

  it("préremplit la direction et laisse le choix du groupe ou de la catégorie", () => {
    const html = renderToStaticMarkup(<CetFormDialog {...common} kind="opening" />);
    expect(html).toContain("Direction des publics - Service de l&#x27;accueil des publics");
    expect(html).toContain('<option value="" selected="">Sélectionner…</option>');
    expect(html).toContain('<option value="Groupe 1">Groupe 1</option>');
    expect(html).toContain('<option value="Catégorie C">Catégorie C</option>');
  });

  it("laisse le formulaire d’alimentation accessible toute l’année", () => {
    const html = renderToStaticMarkup(<CetFormDialog {...common} kind="funding" />);
    expect(html).toContain("vous pouvez préparer ce formulaire maintenant");
    expect(html).toContain('role="alert"');
    expect(html).toContain("15 novembre");
    expect(html).toContain("31 décembre");
    expect(html).toContain("Aide au remplissage");
    expect(html).toContain('aria-controls="cet-form-help"');
  });

  it("réserve l’aide au formulaire d’alimentation", () => {
    const html = renderToStaticMarkup(<CetFormDialog {...common} kind="opening" />);
    expect(html).not.toContain("Aide au remplissage");
  });
});
