/** Crée un identifiant côté navigateur, y compris dans une démo mobile HTTP
 * où `crypto.randomUUID` peut être indisponible car la page n'est pas dans un
 * contexte sécurisé. */
export function createClientId(
  prefix = "item",
  uuidFactory: (() => string) | null | undefined =
    typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID
      ? globalThis.crypto.randomUUID.bind(globalThis.crypto)
      : null,
) {
  // Le préfixe fait partie du contrat de l’identifiant : certaines entrées
  // (notamment les soldes d’heures ajoutés manuellement) sont reconnues par
  // le serveur grâce à lui. Il doit donc être conservé aussi en HTTPS, quand
  // randomUUID est disponible.
  if (uuidFactory) return `${prefix}-${uuidFactory()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}
