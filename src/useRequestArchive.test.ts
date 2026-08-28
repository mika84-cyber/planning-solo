import { describe, expect, it } from "vitest";
import {
  archiveOwnerKey,
  visibleArchivedRequests,
  type ArchivedRequest,
} from "./useRequestArchive";

function archived(id: string, ownerKey?: string, updatedAt = "2026-08-28T10:00:00.000Z") {
  return {
    id,
    ownerKey,
    name: `${id}.pdf`,
    createdAt: updatedAt,
    updatedAt,
    blob: new Blob(),
  } satisfies ArchivedRequest;
}

describe("archive locale des demandes", () => {
  it("normalise l’adresse qui isole les archives", () => {
    expect(archiveOwnerKey("  Mika@Example.FR ")).toBe("mika@example.fr");
  });

  it("ne montre que les archives du compte courant", () => {
    expect(visibleArchivedRequests([
      archived("main", "mika@example.fr", "2026-08-28T12:00:00.000Z"),
      archived("guest", "invite@example.fr", "2026-08-28T13:00:00.000Z"),
      archived("legacy"),
    ], "mika@example.fr").map((request) => request.id)).toEqual(["main"]);
  });

  it("classe les archives les plus récentes en premier", () => {
    expect(visibleArchivedRequests([
      archived("old", "mika@example.fr", "2026-08-27T12:00:00.000Z"),
      archived("recent", "mika@example.fr", "2026-08-28T12:00:00.000Z"),
    ], "mika@example.fr").map((request) => request.id)).toEqual(["recent", "old"]);
  });
});
