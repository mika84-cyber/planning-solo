/** Les annonces d'exposition lues (« Compris » sur l'accueil), telles que le
 *  compte les retient pour le téléphone comme pour l'ordinateur : leurs
 *  repères (expoNotices.ts), les quarante derniers. Un repère porte le jour de
 *  l'ouverture ou le dernier jour de l'exposition : passé ce jour, l'annonce
 *  ne s'affiche plus et son repère ne sert plus, d'où `from`, qui écarte les
 *  repères plus anciens. Partagé avec le serveur : rien d'autre ici. */
const ID = /^(?:opening|closing):[A-Za-z0-9:-]{1,60}:(\d{4}-\d{2}-\d{2}):[a-z ]{0,120}$/;

export function sanitizeExpoNoticesSeen(value: unknown, from = ""): string[] {
  if (!Array.isArray(value)) return [];
  const kept = value.filter((id): id is string => typeof id === "string" && (ID.exec(id)?.[1] ?? "") >= (from || "0"));
  return [...new Set(kept)].slice(-40);
}
