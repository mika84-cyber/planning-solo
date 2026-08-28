/**
 * Les écritures de l’application doivent venir de la même origine. Les appels
 * internes Netlify et certains clients non-navigateurs n’envoient pas Origin :
 * ils restent autorisés, tandis qu’un formulaire lancé par un autre site est
 * refusé avant toute mutation.
 */
export function isTrustedMutation(request: Request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
