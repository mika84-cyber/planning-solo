import { beforeEach, describe, expect, it } from "vitest";
import { readColleagueBoardCache, writeColleagueBoardCache } from "./colleagueBoardCache";
import type { ColleagueDirectory } from "./colleagueSharingApi";

const directory = {
  self: { userId: "u1", displayName: "Mika", visible: true },
  canShareWithoutApproval: true,
  directory: [],
  incoming: [],
  outgoing: [],
} as unknown as ColleagueDirectory;

describe("cache du tableau des collègues", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    } as Storage;
  });

  it("rend l'annuaire et les plannings du même compte, jamais d'un autre", () => {
    const plannings = { agnes: { owner: { userId: "agnes", displayName: "Agnès" }, group: 1, days: [] } };
    writeColleagueBoardCache("Mika@Example.fr", { directory, plannings });
    expect(readColleagueBoardCache("mika@example.fr")).toEqual({ directory, plannings });
    expect(readColleagueBoardCache("autre@example.fr")).toBeNull();
  });
});
