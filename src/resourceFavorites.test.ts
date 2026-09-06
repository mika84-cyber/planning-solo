import { describe, expect, it } from "vitest";
import { readResourceFavorites, resourceFavoritesKey, writeResourceFavorites } from "./resourceFavorites";

describe("favoris des ressources", () => {
  it("isole les favoris par compte et par rubrique", () => {
    expect(resourceFavoritesKey("Alice@Example.FR", "documents")).not.toBe(resourceFavoritesKey("bob@example.fr", "documents"));
    expect(resourceFavoritesKey("alice@example.fr", "documents")).not.toBe(resourceFavoritesKey("alice@example.fr", "contacts"));
  });

  it("enregistre des identifiants stables sans doublon", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    writeResourceFavorites("alice@example.fr", "documents", ["demande-conges.pdf", "demande-conges.pdf"], storage);
    expect(readResourceFavorites("alice@example.fr", "documents", storage)).toEqual(["demande-conges.pdf"]);
    expect(readResourceFavorites("bob@example.fr", "documents", storage)).toEqual([]);
  });
});
