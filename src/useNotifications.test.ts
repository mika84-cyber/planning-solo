import { describe, expect, it } from "vitest";
import { sameApplicationServerKey } from "./useNotifications";

describe("abonnement aux notifications partagées", () => {
  it("détecte une ancienne clé VAPID afin de recréer l’abonnement", () => {
    const expected = new Uint8Array([1, 2, 3, 4]);
    expect(sameApplicationServerKey(new Uint8Array([1, 2, 3, 4]).buffer, expected)).toBe(true);
    expect(sameApplicationServerKey(new Uint8Array([1, 2, 9, 4]).buffer, expected)).toBe(false);
    expect(sameApplicationServerKey(null, expected)).toBe(false);
  });
});
