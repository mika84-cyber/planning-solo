import type { FormEvent } from "react";
import type { AuthStatus } from "./appModel";

type Props = {
  status: Exclude<AuthStatus, "ready">;
  email: string;
  password: string;
  busy: boolean;
  error: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submitLogin: (event: FormEvent) => void;
  submitInvite: (event: FormEvent) => void;
};

export function AuthScreen({
  status,
  email,
  password,
  busy,
  error,
  setEmail,
  setPassword,
  submitLogin,
  submitInvite,
}: Props) {
  if (status === "loading") {
    return (
      <main className="auth-splash">
        <img
          src="/grand-palais-verriere.jpg"
          alt=""
          className="auth-splash-image"
        />
        <div className="auth-loader auth-splash-loader" aria-label="Chargement" />
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <img
        src="/grand-palais-verriere.jpg"
        alt=""
        className="auth-shell-image"
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
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Activation…" : "Activer mon accès"}
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
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
            <p className="auth-help">
              L’accès est réservé au compte invité sur ce planning.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
