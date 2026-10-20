/** L'écran d'une démonstration publique dont le lien a expiré. */
export function DemoExpiredScreen() {
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
    <div className="auth-mark" aria-hidden="true"><span>31</span></div>
    <p className="eyebrow">Planning Solo</p>
    <h1>Essai terminé</h1>
    <p className="auth-intro">
      Ce lien de démonstration a expiré le 15 septembre 2026.
    </p>
  </section>
</main>
  );
}
