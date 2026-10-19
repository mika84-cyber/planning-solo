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
import colleagueGroupsHandler from "../functions/colleague-groups.mts";

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
    expect((await colleagueGroupsHandler(new Request("https://example.test/api/colleague-groups"))).status).toBe(401);
  });

  it("charge les groupes par une route authentifiée légère", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "alice@example.test" } as never);
    const response = await colleagueGroupsHandler(new Request("https://example.test/api/colleague-groups"));
    const payload = await response.json() as { groups: Array<{ members: string[] }> };

    expect(response.status).toBe(200);
    expect(payload.groups.map((group) => group.members.length)).toEqual([36, 36, 35]);
  });

  it("fournit les trois groupes uniquement après authentification, sans les destinataires en copie", async () => {
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "alice@example.test" } as never);
    const response = await colleaguesHandler(new Request("https://example.test/api/colleagues"));
    const payload = await response.json() as { groups: Array<{ number: number; members: string[] }> };
    const members = payload.groups.flatMap((group) => group.members);

    expect(payload.groups.map((group) => group.members.length)).toEqual([36, 36, 35]);
    expect(members).toContain("Mickaël Eliaszewicz");
    expect(members).not.toEqual(expect.arrayContaining([
      "Maarten Averink",
      "Hicham Azalmat",
      "Mathieu Bohet",
      "Wilnise Cedelle",
      "Guillaume Fayon",
      "Priscilla Fantoli",
      "Simon Ladjouzi",
      "Astrid Metri",
      "Hubert Renard",
      "Thierry Medout-Marere",
      "Tarah Geoffre Orgusaare",
      "Paolo Sescousse",
    ]));
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

  it("montre en absence une journée entière posée en heures de récupération", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    data.set("colleagues/share/viewer/user-b/user-a", {
      ownerId: "user-a", viewerId: "user-b", ownerName: "Alice", viewerName: "Benoît",
      status: "accepted", createdAt: "2026-09-01", updatedAt: "2026-09-01",
    });
    const { getDayInfo } = await import("../../src/planningLogic");
    const day = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`)
      .find((date) => getDayInfo(new Date(`${date}T12:00:00`), 3).kind === "work")!;
    // Horaires de 10 h à 17 h 45 : toute la journée posée en heures.
    data.set("user/user-a/form-profile", { group: "3", work_schedule: { start: "10:00", end: "17:45" } });
    data.set("user/user-a/recovery-use/rec-1", { date: day, minutes: 465, start: "10:00", end: "17:45" });
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "b@example.test" } as never);
    const payload = await (await colleaguesHandler(new Request("https://example.test/api/colleagues?ownerId=user-a"))).json() as { days: Array<{ date: string; status: string }> };
    expect(payload.days).toEqual(expect.arrayContaining([expect.objectContaining({ date: day, status: "absence" })]));
  });

  it("montre en journée travaillée quelques heures de récupération", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    data.set("colleagues/share/viewer/user-b/user-a", {
      ownerId: "user-a", viewerId: "user-b", ownerName: "Alice", viewerName: "Benoît",
      status: "accepted", createdAt: "2026-09-01", updatedAt: "2026-09-01",
    });
    const { getDayInfo } = await import("../../src/planningLogic");
    const day = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`)
      .find((date) => getDayInfo(new Date(`${date}T12:00:00`), 3).kind === "work")!;
    data.set("user/user-a/form-profile", { group: "3" });
    // Deux heures posées le matin : rien ne se voit côté collègues.
    data.set("user/user-a/recovery-use/rec-1", { date: day, minutes: 120, start: "10:00", end: "12:00" });
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "b@example.test" } as never);
    const payload = await (await colleaguesHandler(new Request("https://example.test/api/colleagues?ownerId=user-a"))).json() as { days: Array<{ date: string; status: string }> };
    expect(payload.days).toEqual(expect.arrayContaining([expect.objectContaining({ date: day, status: "work" })]));

    // Une demi-journée posée en récupération reste signalée « 1/2 ».
    data.set("user/user-a/recovery-use/rec-1", { date: day, minutes: 240, start: "10:00", end: "14:00" });
    const half = await (await colleaguesHandler(new Request("https://example.test/api/colleagues?ownerId=user-a"))).json() as { days: Array<{ date: string; status: string }> };
    expect(half.days).toEqual(expect.arrayContaining([expect.objectContaining({ date: day, status: "partial" })]));
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

  it("propose un échange à un collègue qui l’accepte : il s’inscrit dans son planning sans ressaisie", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "user-a@example.test" } as never);
    const proposed = await colleaguesHandler(post({
      action: "propose-exchange", id: "exchange-1", partnerId: "user-b", group: 2,
      agreementDate: "2026-11-03", returnDate: "2026-11-10", agreementStart: "10:00", agreementEnd: "18:00", returnStart: "", returnEnd: "",
    }));
    expect(proposed.status).toBe(200);
    expect((await proposed.json()).exchangeRequests.outgoing[0]).toMatchObject({ toName: "Benoît", status: "pending" });

    mockedGetUser.mockResolvedValue({ id: "user-b", email: "user-b@example.test" } as never);
    const seen = await (await colleaguesHandler(new Request("https://example.test/api/colleagues"))).json();
    expect(seen.exchangeRequests.incoming[0]).toMatchObject({ id: "exchange-1", fromName: "Alice", agreementDate: "2026-11-03", agreementStart: "10:00" });
    // Benoît (groupe 3) se repose le 3/11, qu'Alice travaille, et travaille le 10/11, qu'elle a en repos.
    data.set("user/user-b/form-profile", { full_name: "Benoît", group: "3" });
    // Une note déjà posée ce jour-là est conservée.
    data.set("user/user-b/entry/2026-11-10", { date: "2026-11-10", note_text: "Dentiste", leave: false, wish: false, updated_at: "v1" });
    const accepted = await colleaguesHandler(post({ action: "respond-exchange", id: "exchange-1", response: "accept" }));
    expect(accepted.status).toBe(200);
    // Benoît travaille la journée d'Alice, se repose la sienne.
    expect(data.get("user/user-b/entry/2026-11-03")).toMatchObject({ exchange_id: "exchange-1", exchange_role: "return", exchange_partner: "Alice", exchange_partner_group: 2, exchange_other_date: "2026-11-10" });
    expect(data.get("user/user-b/entry/2026-11-10")).toMatchObject({ exchange_role: "given", note_text: "Dentiste", exchange_other_date: "2026-11-03" });
    expect((await accepted.json()).exchangeRequests.incoming).toEqual([]);

    // Alice voit la réponse, puis la range.
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "user-a@example.test" } as never);
    const result = await (await colleaguesHandler(new Request("https://example.test/api/colleagues"))).json();
    expect(result.exchangeRequests.outgoing[0]).toMatchObject({ status: "accepted" });
    await colleaguesHandler(post({ action: "clear-exchange-request", id: "exchange-1" }));
    expect(data.has("colleagues/exchange/from/user-a/exchange-1")).toBe(false);
    expect(data.has("colleagues/exchange/to/user-b/exchange-1")).toBe(false);
  });

  it("inscrit un échange accepté sur une journée vidée comme sur une journée vierge", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    const request = {
      id: "exchange-vide", fromId: "user-a", fromName: "Alice", fromGroup: 2, toId: "user-b", toName: "Benoît",
      agreementDate: "2026-11-03", returnDate: "2026-11-10", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "",
      status: "pending", createdAt: "2026-10-01", updatedAt: "2026-10-01",
    };
    data.set("colleagues/exchange/to/user-b/exchange-vide", request);
    data.set("colleagues/exchange/from/user-a/exchange-vide", request);
    data.set("user/user-b/form-profile", { full_name: "Benoît", group: "3" });
    // Une journée dont la note a été effacée garde une pierre tombale.
    data.set("user/user-b/entry/2026-11-03", { __calendar_tombstone: true });
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "user-b@example.test" } as never);
    const accepted = await colleaguesHandler(post({ action: "respond-exchange", id: "exchange-vide", response: "accept" }));
    expect(accepted.status).toBe(200);
    const day = data.get("user/user-b/entry/2026-11-03") as Record<string, unknown>;
    expect(day).toMatchObject({ date: "2026-11-03", exchange_id: "exchange-vide", exchange_role: "return", leave: false });
    expect(day).not.toHaveProperty("__calendar_tombstone");
  });

  it("refuse un échange proposé qui heurte un congé, une récupération, une fermeture ou le cycle du destinataire", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    // Alice (groupe 2) cède le 12/11 et reprend le 19/11 de Benoît (groupe 3).
    const request = {
      id: "exchange-controle", fromId: "user-a", fromName: "Alice", fromGroup: 2, toId: "user-b", toName: "Benoît",
      agreementDate: "2026-11-12", returnDate: "2026-11-19", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "",
      status: "pending", createdAt: "2026-10-01", updatedAt: "2026-10-01",
    };
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "user-b@example.test" } as never);
    const attempt = async (setup: () => void) => {
      for (const key of [...data.keys()]) if (key.startsWith("user/user-b/")) data.delete(key);
      data.set("user/user-b/form-profile", { full_name: "Benoît", group: "3" });
      data.set("colleagues/exchange/to/user-b/exchange-controle", request);
      data.set("colleagues/exchange/from/user-a/exchange-controle", request);
      setup();
      const response = await colleaguesHandler(post({ action: "respond-exchange", id: "exchange-controle", response: "accept" }));
      const payload = await response.json() as { error?: string };
      return { status: response.status, error: payload.error };
    };

    // Des CA du 17 au 21/11 couvrent la journée que Benoît céderait.
    expect(await attempt(() => data.set("user/user-b/period/ca-novembre", {
      id: "ca-novembre", from: "2026-11-17", to: "2026-11-21", leave_type: "annual", group: 3, updated_at: "v1",
    }))).toEqual({ status: 409, error: "Une des dates comporte déjà un congé ou une récupération." });
    expect(await attempt(() => data.set("user/user-b/recovery-use/recup-12", {
      id: "recup-12", date: "2026-11-12", minutes: 120, start: "10:00", end: "12:00", updated_at: "v1",
    }))).toEqual({ status: 409, error: "Une des dates comporte déjà un congé ou une récupération." });
    expect(await attempt(() => data.set("user/user-b/entry/2026-11-19", {
      date: "2026-11-19", closure_override: "closed", leave: false, wish: false, updated_at: "v1",
    }))).toEqual({ status: 409, error: "Un échange est impossible pendant une fermeture exceptionnelle." });
    // Au groupe 1, Benoît travaille déjà le 12/11.
    expect(await attempt(() => data.set("user/user-b/form-profile", { full_name: "Benoît", group: "1" })))
      .toEqual({ status: 409, error: "Pour la journée du cycle du collègue, vous devez être en repos et votre collègue doit travailler." });
    // Sans groupe enregistré, Benoît est au groupe 2 comme dans l'application : celui d'Alice.
    expect(await attempt(() => data.set("user/user-b/form-profile", { full_name: "Benoît" })))
      .toEqual({ status: 409, error: "Alice est de votre groupe : cet échange ne correspond pas à vos cycles." });

    expect(data.has("user/user-b/entry/2026-11-12")).toBe(false);
    expect(data.get("colleagues/exchange/to/user-b/exchange-controle")).toMatchObject({ status: "pending" });
    // Sans obstacle, l'échange s'inscrit.
    expect((await attempt(() => undefined)).status).toBe(200);
    expect(data.get("user/user-b/entry/2026-11-19")).toMatchObject({ exchange_id: "exchange-controle", exchange_role: "given" });
  });

  it("n’enregistre que des heures réelles dans une proposition d’échange", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    mockedGetUser.mockResolvedValue({ id: "user-a", email: "user-a@example.test" } as never);
    expect((await colleaguesHandler(post({
      action: "propose-exchange", id: "exchange-heures", partnerId: "user-b", group: 2,
      agreementDate: "2026-11-03", returnDate: "2026-11-10",
      agreementStart: "99:99", agreementEnd: "24:00", returnStart: "09:15", returnEnd: "7:30",
    }))).status).toBe(200);
    expect(data.get("colleagues/exchange/to/user-b/exchange-heures")).toMatchObject({
      agreementStart: "", agreementEnd: "", returnStart: "09:15", returnEnd: "",
    });
  });

  it("remplace les anciennes journées d’un échange accepté puis modifié, sans redemander un échange inchangé", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    data.set("user/user-b/form-profile", { full_name: "Benoît", group: "3" });
    data.set("user/user-b/entry/2026-11-10", { date: "2026-11-10", note_text: "Dentiste", leave: false, wish: false, updated_at: "v1" });
    const propose = (agreementDate: string, returnDate: string) => {
      mockedGetUser.mockResolvedValue({ id: "user-a", email: "user-a@example.test" } as never);
      return colleaguesHandler(post({
        action: "propose-exchange", id: "exchange-modifie", partnerId: "user-b", group: 2,
        agreementDate, returnDate, agreementStart: "10:00", agreementEnd: "18:00", returnStart: "", returnEnd: "",
      }));
    };
    const accept = () => {
      mockedGetUser.mockResolvedValue({ id: "user-b", email: "user-b@example.test" } as never);
      return colleaguesHandler(post({ action: "respond-exchange", id: "exchange-modifie", response: "accept" }));
    };
    await propose("2026-11-03", "2026-11-10");
    expect((await accept()).status).toBe(200);

    // Le même échange, renvoyé sans changement, reste accepté.
    await propose("2026-11-03", "2026-11-10");
    expect(data.get("colleagues/exchange/to/user-b/exchange-modifie")).toMatchObject({ status: "accepted" });

    // Alice déplace l'échange : Benoît le revalide, ses anciennes journées sont libérées.
    await propose("2026-11-12", "2026-11-19");
    expect(data.get("colleagues/exchange/to/user-b/exchange-modifie")).toMatchObject({ status: "pending" });
    expect((await accept()).status).toBe(200);
    expect(data.has("user/user-b/entry/2026-11-03")).toBe(false);
    const freed = data.get("user/user-b/entry/2026-11-10") as Record<string, unknown>;
    expect(freed).toMatchObject({ note_text: "Dentiste" });
    expect(freed).not.toHaveProperty("exchange_id");
    expect(data.get("user/user-b/entry/2026-11-12")).toMatchObject({ exchange_id: "exchange-modifie", exchange_role: "return" });
    expect(data.get("user/user-b/entry/2026-11-19")).toMatchObject({ exchange_id: "exchange-modifie", exchange_role: "given" });
  });

  it("ne laisse pas un expéditeur écraser la proposition d’un autre, et retire celle d’un collègue remplacé", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît"); profile("user-c", "Chloé");
    const proposal = (sender: string, partnerId: string) => {
      mockedGetUser.mockResolvedValue({ id: sender, email: `${sender}@example.test` } as never);
      return colleaguesHandler(post({
        action: "propose-exchange", id: "exchange-commun", partnerId, group: 2,
        agreementDate: "2026-11-03", returnDate: "2026-11-10",
      }));
    };
    expect((await proposal("user-a", "user-b")).status).toBe(200);
    const overwrite = await proposal("user-c", "user-b");
    expect(overwrite.status).toBe(409);
    expect(data.get("colleagues/exchange/to/user-b/exchange-commun")).toMatchObject({ fromId: "user-a" });
    expect(data.has("colleagues/exchange/from/user-c/exchange-commun")).toBe(false);

    // Alice adresse finalement l'échange à Chloé : Benoît ne le voit plus.
    expect((await proposal("user-a", "user-c")).status).toBe(200);
    expect(data.has("colleagues/exchange/to/user-b/exchange-commun")).toBe(false);
    expect(data.get("colleagues/exchange/to/user-c/exchange-commun")).toMatchObject({ fromId: "user-a", status: "pending" });
  });

  it("refuse d’inscrire un échange sur une journée déjà prise, et retient un refus", async () => {
    profile("user-a", "Alice"); profile("user-b", "Benoît");
    const request = {
      id: "exchange-2", fromId: "user-a", fromName: "Alice", fromGroup: 2, toId: "user-b", toName: "Benoît",
      agreementDate: "2026-11-03", returnDate: "2026-11-10", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "",
      status: "pending", createdAt: "2026-10-01", updatedAt: "2026-10-01",
    };
    data.set("colleagues/exchange/to/user-b/exchange-2", request);
    data.set("colleagues/exchange/from/user-a/exchange-2", request);
    data.set("user/user-b/form-profile", { full_name: "Benoît", group: "3" });
    data.set("user/user-b/entry/2026-11-03", { date: "2026-11-03", exchange_id: "autre", exchange_role: "given", leave: false, wish: false, updated_at: "v1" });
    mockedGetUser.mockResolvedValue({ id: "user-b", email: "user-b@example.test" } as never);
    const blocked = await colleaguesHandler(post({ action: "respond-exchange", id: "exchange-2", response: "accept" }));
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({ error: "Une des dates appartient déjà à un autre échange." });
    expect(data.get("colleagues/exchange/to/user-b/exchange-2")).toMatchObject({ status: "pending" });
    expect((await colleaguesHandler(post({ action: "respond-exchange", id: "exchange-2", response: "decline" }))).status).toBe(200);
    expect(data.get("colleagues/exchange/from/user-a/exchange-2")).toMatchObject({ status: "declined" });
    expect(data.get("user/user-b/entry/2026-11-10")).toBeUndefined();
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
