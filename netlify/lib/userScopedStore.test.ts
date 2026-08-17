import { describe, expect, it } from "vitest";
import type { getStore } from "@netlify/blobs";
import {
  migrateLegacyData,
  userDataKey,
  userDataPrefix,
} from "./userScopedStore.mts";

type Store = ReturnType<typeof getStore>;

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  const store = {
    async get(key: string) {
      return data.has(key) ? data.get(key) : null;
    },
    async list({ prefix = "" }: { prefix?: string } = {}) {
      return {
        blobs: [...data.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key, etag: key })),
        directories: [],
      };
    },
    async setJSON(
      key: string,
      value: unknown,
      options?: { onlyIfNew?: boolean },
    ) {
      if (options?.onlyIfNew && data.has(key)) return { modified: false };
      data.set(key, value);
      return { modified: true, etag: key };
    },
  } as unknown as Store;
  return { data, store };
}

describe("clés de données par utilisateur", () => {
  it("encode l'identifiant dans un espace propre au compte", () => {
    expect(userDataPrefix("user/with space")).toBe(
      "user/user%2Fwith%20space/",
    );
    expect(userDataKey("abc", "entry/2026-08-17")).toBe(
      "user/abc/entry/2026-08-17",
    );
  });
});

describe("migration des anciennes données", () => {
  it("copie le planning, les périodes et le profil dans le premier compte", async () => {
    const entry = { date: "2026-08-17", note_text: "Test" };
    const period = { id: "period-1", from: "2026-08-17" };
    const profile = { full_name: "Agnès" };
    const { data, store } = memoryStore({
      "entry/2026-08-17": entry,
      "period/period-1": period,
      "form-profile": profile,
    });

    await migrateLegacyData(store, "first-user");

    expect(data.get("user/first-user/entry/2026-08-17")).toEqual(entry);
    expect(data.get("user/first-user/period/period-1")).toEqual(period);
    expect(data.get("user/first-user/form-profile")).toEqual(profile);
    expect(data.get("migration/legacy-owner-v1")).toMatchObject({
      user_id: "first-user",
    });
    expect(data.get("user/first-user/migration/legacy-import-v1")).toMatchObject(
      { status: "migrated" },
    );
  });

  it("ne donne jamais les anciennes données à un second compte", async () => {
    const { data, store } = memoryStore({
      "entry/2026-08-17": { date: "2026-08-17" },
    });

    await migrateLegacyData(store, "first-user");
    await migrateLegacyData(store, "second-user");

    expect(data.has("user/second-user/entry/2026-08-17")).toBe(false);
    expect(
      data.get("user/second-user/migration/legacy-import-v1"),
    ).toMatchObject({ status: "owned-by-another-user" });
  });

  it("n'écrase pas une donnée déjà enregistrée dans l'espace personnel", async () => {
    const { data, store } = memoryStore({
      "entry/2026-08-17": { note_text: "ancienne" },
      "user/first-user/entry/2026-08-17": { note_text: "récente" },
    });

    await migrateLegacyData(store, "first-user");

    expect(data.get("user/first-user/entry/2026-08-17")).toEqual({
      note_text: "récente",
    });
  });
});
