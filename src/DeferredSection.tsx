/** Attente d'une section chargée à la demande, annoncée aux lecteurs d'écran. */
export function DeferredSection({ label }: { label: string }) {
  return <div className="deferred-section-loading" role="status">Chargement de {label}…</div>;
}
