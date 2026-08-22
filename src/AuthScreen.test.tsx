import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";

const baseProps = {
  email: "collegue@example.fr",
  password: "",
  passwordConfirmation: "",
  busy: false,
  error: "",
  notice: "",
  setEmail: vi.fn(),
  setPassword: vi.fn(),
  setPasswordConfirmation: vi.fn(),
  submitLogin: vi.fn(),
  submitInvite: vi.fn(),
  submitPasswordReset: vi.fn(),
  requestPasswordReset: vi.fn(),
};

describe("écran de connexion", () => {
  it("explique la première connexion et propose le mot de passe oublié", () => {
    const html = renderToStaticMarkup(<AuthScreen {...baseProps} status="guest" />);
    expect(html).toContain("Mot de passe oublié ?");
    expect(html).toContain("Première connexion ?");
    expect(html).toContain("e-mail d’invitation");
  });

  it("affiche la confirmation d'envoi sans révéler si le compte existe", () => {
    const html = renderToStaticMarkup(
      <AuthScreen {...baseProps} status="guest" notice="Si ce compte est activé, un e-mail vient d’être envoyé." />,
    );
    expect(html).toContain("Si ce compte est activé");
    expect(html).toContain('role="status"');
  });

  it("demande deux saisies lors de la réinitialisation", () => {
    const html = renderToStaticMarkup(<AuthScreen {...baseProps} status="recovery" />);
    expect(html).toContain("Nouveau mot de passe");
    expect(html).toContain("Confirmer le mot de passe");
    expect(html).toContain("Enregistrer et ouvrir mon planning");
  });
});
