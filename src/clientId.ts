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
  if (uuidFactory) return uuidFactory();
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}
