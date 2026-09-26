import { getUser, type User } from "@netlify/identity";

type IdentityClaims = {
  sub?: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type IdentityContext = { url?: string; token?: string; user?: IdentityClaims };

/**
 * L'utilisateur connecté, d'après le jeton que Netlify a déjà vérifié.
 *
 * `getUser()` de @netlify/identity 2.0 demande d'abord la fiche complète à
 * `/.netlify/identity/user` avec la clé de service de la fonction au lieu du
 * jeton de la personne : Netlify répond 400 à chaque appel, puis la
 * bibliothèque se rabat sur ces mêmes informations vérifiées. On les lit
 * directement : même résultat, sans l'appel en erreur ni son délai.
 */
export async function currentUser(
  context: IdentityContext | undefined = (globalThis as { netlifyIdentityContext?: IdentityContext })
    .netlifyIdentityContext,
): Promise<User | null> {
  const claims = context?.user;
  if (claims?.sub) {
    const appMetadata = claims.app_metadata ?? {};
    const userMetadata = claims.user_metadata ?? {};
    const name = userMetadata.full_name ?? userMetadata.name;
    const roles = appMetadata.roles;
    return {
      id: claims.sub,
      email: claims.email,
      name: typeof name === "string" ? name : undefined,
      roles: Array.isArray(roles) && roles.every((role) => typeof role === "string") ? roles : undefined,
      userMetadata,
      appMetadata,
    } as User;
  }
  // Netlify a examiné la demande sans y trouver de jeton valable.
  if (context?.url) return null;
  // Hors de la plateforme (développement local) : la bibliothèque décide.
  return getUser();
}
