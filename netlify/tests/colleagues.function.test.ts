import { beforeEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, unknown>();
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  setJSON: vi.fn(async (key: string, value: unknown) => { data.set(key, value); return { modified: true }; }),
  delete: vi.fn(async (key: string) => { data.delete(key); }),
  list: vi.fn(({ prefix }: { prefix: string }) => ({
    async *[Symbol.asyncIterator]() {
      yield { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    },
  })),
};
vi.mock("@netlify/identity", () => ({ getUser: vi.fn(), admin: { listUsers: vi.fn(), getUser: vi.fn() } }));
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));
vi.mock("../lib/sharedCalendarBridge.mts", () => ({ isMikaSharingAccount: vi.fn() }));
vi.mock("../lib/colleagueSharingEmail.mts", () => ({ sendColleagueSharingEmail: vi.fn() }));

import { admin, getUser } from "@netlify/identity";
import { isMikaSharingAccount } from "../lib/sharedCalendarBridge.mts";
import { sendColleagueSharingEmail } from "../lib/colleagueSharingEmail.mts";
import colleaguesHandler from "../functions/colleagues.mts";

const mockedGetUser = vi.mocked(getUser);
const listIdentityUsers = vi.mocked(admin.listUsers);
const getIdentityUser = vi.mocked(admin.getUser);
const privileged = vi.mocked(isMikaSharingAccount);
const sendEmail = vi.mocked(sendColleagueSharingEmail);
const post = (body: unknown) => new Request("https://example.test/api/colleagues", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const profile = (id: string, name: string) => data.set(`colleagues/profile/${id}`, {
  userId: id, displayName: name, email: `${id}@example.test`, visible: true, updatedAt: "2026-09-02T10:00:00.000Z",
});

describe("partage des plannings entre collègues", () => {
  beforeEach(() => {
    data.clear();
    mockedGetUser.mockReset();
    listIdentityUsers.mockReset();
    listIdentityUsers.mockResolvedValue([]);
    getIdentityUser.mockReset();
    getIdentityUser.mockImplementation(async (userId) => ({ id: userId, email: `${userId}@example.test` }) as never);
    privileged.mockReset();
    privileged.mockResolvedValue(false);
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(true);
  });

  it("refuse tout accès sans authentification", async () => {
    mockedGetUser.mockResolvedValue(null);
    expect((await colleaguesHandler(new Request("https://example.test/api/colleagues"))).status).toBe(401);
  });

  it("permet un blocage silencieux avant l’inscription tout en verrouillant le partage", async () => {
    profile("user-b", "Benoît");
    data.set("user/user-a/form-profile", { full_name: "Alice" });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "alice@example.test" } as never);
    const first = await colleaguesHandler(new Request("https://example.test/api/colleagues"));
    const firstPayload = await first.json() as { self: { visible: boolean }; directory: Array<{ userId: string }> };
    expect(firstPayload.self.visible).toBe(false);
    expect(firstPayload.directory).toContainEqual(expect.objectContaining({ userId: "user-b" }));

    const blocked = await colleaguesHandler(post({ action: "block-person", userId: "user-b" }));
    const blockedPayload = await blocked.json() as { directory: unknown[]; blocked: Array<{ userId: string }> };
    expect(blockedPayload.directory).toHaveLength(0);
    expect(blockedPayload.blocked).toContainEqual(expect.objectContaining({ userId: "user-b" }));

    const refusedShare = await colleaguesHandler(post({ action: "share", viewerId: "user-b" }));
    expect(refusedShare.status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();

    await colleaguesHandler(post({ action: "set-profile", displayName: "Alice", visible: true }));

    mockedGetUser.mockResolvedValue({ id: "user-b", email: "user-b@example.test" } as never);
    const otherView = await colleaguesHandler(new Request("https://example.test/api/colleagues"));
    const otherPayload = await otherView.json() as { directory: Array<{ userId: string }> };
    expect(otherPayload.directory).not.toContainEqual(expect.objectContaining({ userId: "user-a" }));
  });

  it("crée une invitation et envoie un e-mail", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "alice@example.test" } as never);
    const response = await colleaguesHandler(post({ action: "share", viewerId: "user-b" }));
    expect(response.status).toBe(200);
    expect(data.get("colleagues/share/viewer/user-b/user-a")).toMatchObject({ status: "pending" });
    expect(sendEmail).toHaveBeenCalledWith("user-b@example.test", "Alice");
  });

  it("récupère directement l’adresse Identity lorsqu’elle manque au profil", async () => {
    profile("user-a", "Alice");
    data.set("colleagues/profile/user-b", {
      userId: "user-b", displayName: "Benoît", visible: true, updatedAt: "2026-09-02T10:00:00.000Z",
    });
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "alice@example.test" } as never);
    getIdentityUser.mockResolvedValue({ id: "user-b", email: "benoit@example.test" } as never);
    const response = await colleaguesHandler(post({ action: "share", viewerId: "user-b" }));
    expect(response.status).toBe(200);
    expect(getIdentityUser).toHaveBeenCalledWith("user-b");
    expect(sendEmail).toHaveBeenCalledWith("benoit@example.test", "Alice");
    expect(data.get("colleagues/profile/user-b")).toMatchObject({ email: "benoit@example.test" });
  });

  it("n’affiche pas une invitation comme envoyée lorsque le mail est refusé", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "alice@example.test" } as never);
    sendEmail.mockRejectedValueOnce(new Error("Resend 403"));
    const response = await colleaguesHandler(post({ action: "share", viewerId: "user-b" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("mail n’a pas pu être envoyé") });
    expect(data.has("colleagues/share/viewer/user-b/user-a")).toBe(false);
    expect(data.has("colleagues/share/owner/user-a/user-b")).toBe(false);
  });

  it("permet à Mika d’inviter un compte Netlify et prévient par e-mail", async () => {
    profile("user-mika", "Mika"); profile("user-b", "Benoît");
    privileged.mockResolvedValue(true);
    mockedGetUser.mockResolvedValue({ id: "user-mika", email: "mika@example.test" } as never);
    await colleaguesHandler(post({ action: "share", viewerId: "user-b" }));
    expect(data.get("colleagues/share/viewer/user-b/user-mika")).toMatchObject({ status: "pending" });
    expect(sendEmail).toHaveBeenCalledWith("user-b@example.test", "Mika");
  });

  it("affiche à Mika tous les profils connus sans révéler ceux qui l’ont bloqué", async () => {
    profile("user-mika", "Mika");
    profile("user-visible", "Benoît");
    data.set("colleagues/profile/user-hidden", {
      userId: "user-hidden", displayName: "camille", email: "camille@example.test",
      visible: false, updatedAt: "2026-08-01",
    });
    listIdentityUsers.mockResolvedValue([
      { id: "user-hidden", email: "camille@example.test", name: "Camille" },
    ]);
    data.set("colleagues/block/against-user/user-mika/user-blocker", {
      blockerId: "user-blocker", blockedId: "user-mika", blockedName: "Mika", createdAt: "2026-09-02",
    });
    profile("user-blocker", "Samir");
    privileged.mockResolvedValue(true);
    mockedGetUser.mockResolvedValue({ id: "user-mika", email: "mika@example.test" } as never);

    const response = await colleaguesHandler(new Request("https://example.test/api/colleagues"));
    const payload = await response.json() as { directory: Array<{ userId: string }> };
    expect(payload.directory).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: "user-visible" }),
      expect.objectContaining({ userId: "user-hidden", displayName: "Camille" }),
    ]));
    expect(payload.directory).not.toContainEqual(expect.objectContaining({ userId: "user-blocker" }));
  });

  it("ne transmet ni notes ni motif d’absence", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    data.set("colleagues/share/viewer/user-b/user-a", {
      ownerId: "user-a", viewerId: "user-b", ownerName: "Alice", viewerName: "Benoît",
      status: "accepted", createdAt: "2026-09-01", updatedAt: "2026-09-01",
    });
    data.set("user/user-a/form-profile", { group: "3", full_name: "Nom complet privé" });
    data.set("user/user-a/period/leave-1", { from: "2026-09-10", to: "2026-09-11", leave_type: "sick" });
    data.set("user/user-a/period/leave-2", { from: "2026-09-15", to: "2026-09-15", leave_type: "half", half_moment: "afternoon" });
    data.set("user/user-a/entry/2026-09-10", { note_text: "Note strictement privée" });
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "b@example.test" } as never);
    const response = await colleaguesHandler(new Request("https://example.test/api/colleagues?ownerId=user-a"));
    const payload = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ group: 3, days: expect.arrayContaining([
      { date: "2026-09-10", status: "absence" },
      { date: "2026-09-11", status: "rest" },
    ]) });
    expect(JSON.stringify(payload)).not.toContain("sick");
    expect(JSON.stringify(payload)).not.toContain("Note strictement privée");
    expect(JSON.stringify(payload)).not.toContain("Nom complet privé");
    expect(payload).toMatchObject({ days: expect.arrayContaining([
      expect.objectContaining({ date: "2026-09-15", status: "partial", halfMoment: "afternoon" }),
    ]) });
  });

  it("refuse la lecture avant acceptation puis l’autorise", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    const invitation = {
      ownerId: "user-a", viewerId: "user-b", ownerName: "Alice", viewerName: "Benoît",
      status: "pending", createdAt: "2026-09-01", updatedAt: "2026-09-01",
    };
    data.set("colleagues/share/viewer/user-b/user-a", invitation);
    data.set("colleagues/share/owner/user-a/user-b", invitation);
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "b@example.test" } as never);
    expect((await colleaguesHandler(new Request("https://example.test/api/colleagues?ownerId=user-a"))).status).toBe(403);
    await colleaguesHandler(post({ action: "respond", ownerId: "user-a", response: "accept" }));
    expect(data.get("colleagues/share/viewer/user-b/user-a")).toMatchObject({ status: "accepted" });
    expect((await colleaguesHandler(new Request("https://example.test/api/colleagues?ownerId=user-a"))).status).toBe(200);
  });

  it("permet au destinataire de supprimer son accès", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    data.set("colleagues/share/viewer/user-b/user-a", {
      ownerId: "user-a", viewerId: "user-b", ownerName: "Alice", viewerName: "Benoît",
      status: "automatic", createdAt: "2026-09-01", updatedAt: "2026-09-01",
    });
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "b@example.test" } as never);
    data.set("colleagues/share/owner/user-a/user-b", data.get("colleagues/share/viewer/user-b/user-a"));
    await colleaguesHandler(post({ action: "remove-access", ownerId: "user-a" }));
    expect(data.has("colleagues/share/viewer/user-b/user-a")).toBe(false);
    expect(data.has("colleagues/share/owner/user-a/user-b")).toBe(false);
  });

  it("retire tous les accès quand une personne refuse le partage", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît"); profile("user-c", "Camille");
    const outgoing = { ownerId: "user-a", viewerId: "user-b", ownerName: "Alice", viewerName: "Benoît", status: "accepted", createdAt: "2026-09-01", updatedAt: "2026-09-01" };
    const incoming = { ownerId: "user-c", viewerId: "user-a", ownerName: "Camille", viewerName: "Alice", status: "accepted", createdAt: "2026-09-01", updatedAt: "2026-09-01" };
    data.set("colleagues/share/owner/user-a/user-b", outgoing);
    data.set("colleagues/share/viewer/user-b/user-a", outgoing);
    data.set("colleagues/share/owner/user-c/user-a", incoming);
    data.set("colleagues/share/viewer/user-a/user-c", incoming);
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
    const response = await colleaguesHandler(post({ action: "disable-sharing" }));
    expect(response.status).toBe(200);
    expect(data.has("colleagues/share/owner/user-a/user-b")).toBe(false);
    expect(data.has("colleagues/share/viewer/user-a/user-c")).toBe(false);
    expect(data.get("colleagues/profile/user-a")).toMatchObject({ visible: false });
  });
});
