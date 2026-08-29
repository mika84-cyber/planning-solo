import type { FormEvent } from "react";
import type { AuthStatus } from "./appModel";

type Props = {
  status: Exclude<AuthStatus, "ready">;
  email: string;
  password: string;
  passwordConfirmation: string;
  busy: boolean;
  error: string;
  notice: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setPasswordConfirmation: (value: string) => void;
  submitLogin: (event: FormEvent) => void;
  submitInvite: (event: FormEvent) => void;
  submitPasswordReset: (event: FormEvent) => void;
  requestPasswordReset: () => void;
};

export function AuthScreen({
  status,
  email,
  password,
  passwordConfirmation,
  busy,
  error,
  notice,
  setEmail,
  setPassword,
  setPasswordConfirmation,
  submitLogin,
  submitInvite,
  submitPasswordReset,
  requestPasswordReset,
}: Props) {
  if (status === "loading") {
    return (
      <main className="auth-splash">
        <img
          src="/grand-palais-verriere-fast.webp"
          alt=""
          className="auth-splash-image"
          decoding="async"
          fetchPriority="high"
        />
        <div className="auth-loader auth-splash-loader" role="status" aria-label="Chargement" />
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <img
        src="/grand-palais-verriere-fast.webp"
        alt=""
        className="auth-shell-image"
        decoding="async"
        fetchPriority="high"
      />
      <section className="auth-card">
        <div className="auth-mark" aria-hidden="true">
          <span>31</span>
        </div>
        <p className="eyebrow">Planning privé</p>
        {status === "invite" ? (
          <form onSubmit={submitInvite}>
            <h1>Bienvenue</h1>
            <p className="auth-intro">
              Choisissez votre mot de passe pour activer votre accès au
              planning.
            </p>
            <label className="auth-field">
              <span>Nouveau mot de passe</span>
              <input
                autoFocus
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Activation…" : "Activer mon accès"}
            </button>
          </form>
        ) : status === "recovery" ? (
          <form onSubmit={submitPasswordReset}>
            <h1>Nouveau mot de passe</h1>
            <p className="auth-intro">
              Choisissez un nouveau mot de passe pour retrouver votre planning.
            </p>
            {email ? <p className="auth-recovery-email">Compte : <strong>{email}</strong></p> : null}
            <label className="auth-field">
              <span>Nouveau mot de passe</span>
              <input
                autoFocus
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label className="auth-field">
              <span>Confirmer le mot de passe</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer et ouvrir mon planning"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitLogin}>
            <h1>Votre planning</h1>
            <p className="auth-intro">
              Connectez-vous pour retrouver vos congés et vos notes.
            </p>
            <label className="auth-field">
              <span>Adresse e-mail</span>
              <input
                autoFocus
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              <span>Mot de passe</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
            <button
              className="auth-forgot-password"
              type="button"
              disabled={busy}
              onClick={requestPasswordReset}
            >
              Mot de passe oublié ?
            </button>
            <div className="auth-account-help">
              <strong>Première connexion ?</strong>
              <p>Ouvrez d’abord l’e-mail d’invitation et touchez son lien pour activer votre compte et choisir votre mot de passe.</p>
              <small>Si l’invitation a expiré ou n’est plus disponible, demandez à la personne qui gère le planning de vous la renvoyer.</small>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
