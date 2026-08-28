export type PublicDemoAccess = {
  active: boolean;
  expired: boolean;
};

/** Active un essai public uniquement dans les builds qui déclarent une échéance. */
export function resolvePublicDemoAccess(
  expiresAt: string | undefined,
  now = Date.now(),
): PublicDemoAccess {
  if (!expiresAt) return { active: false, expired: false };
  const expiration = Date.parse(expiresAt);
  if (!Number.isFinite(expiration)) return { active: false, expired: false };
  return {
    active: now <= expiration,
    expired: now > expiration,
  };
}
