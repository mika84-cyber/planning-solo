import { beforeEach, describe, expect, it, vi } from "vitest";

// Un seul stockage pour les deux API : ce que le collègue enregistre dans son
// planning est exactement ce que relit le planning partagé.
const data = new Map<string, unknown>();
const etagFor = (key: string) => data.has(key) ? `etag:${JSON.stringify(data.get(key))}` : "";
const setStoredJson = async (
  key: string,
  value: unknown,
  options?: { onlyIfNew?: boolean; onlyIfMatch?: string },
) => {
  if (options?.onlyIfNew && data.has(key)) return { modified: false };
  if (options?.onlyIfMatch && options.onlyIfMatch !== etagFor(key)) return { modified: false };
  data.set(key, value);
  return { modified: true, etag: etagFor(key) };
};
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  getWithMetadata: vi.fn(async (key: string) => data.has(key) ? { data: data.get(key), etag: etagFor(key), metadata: {} } : null),
  setJSON: vi.fn(setStoredJson),
  set: vi.fn(async (key: string, value: unknown) => { data.set(key, value); }),
  delete: vi.fn(async (key: string) => { data.delete(key); }),
  list: vi.fn(({ prefix }: { prefix: string }) => ({
    async *[Symbol.asyncIterator]() {
      yield { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    },
  })),
};
vi.mock("@netlify/identity", () => ({ getUser: vi.fn(), admin: { listUsers: vi.fn(async () => []), getUser: vi.fn() } }));
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => store) }));
vi.mock("../lib/colleagueSharingEmail.mts", () => ({ sendColleagueSharingEmail: vi.fn(async () => true) }));

import { getUser } from "@netlify/identity";
import calendarHandler from "../functions/calendar.mts";
import colleaguesHandler from "../functions/colleagues.mts";
import { GRAND_PALAIS_EXCEPTIONAL_CLOSURES } from "../../src/grandPalaisClosures.ts";
import { addDays, dateKey, getDayInfo } from "../../src/planningLogic.ts";

const mockedGetUser = vi.mocked(getUser);
const asOwner = () => mockedGetUser.mockResolvedValue({ id: "user-a", email: "a@example.test" } as never);
const asViewer = () => mockedGetUser.mockResolvedValue({ id: "user-b", email: "b@example.test" } as never);
const save = async (body: Record<string, unknown>) => {
  asOwner();
  const response = await calendarHandler(new Request("https://example.test/api/calendar", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  expect(response.status).toBe(200);
};
type SharedDay = { date: string; status: string; halfMoment?: string; workPost?: WorkPostValue };
type WorkPostValue = "counter" | "ticketing" | "";
const sharedDays = async () => {
  asViewer();
  const response = await colleaguesHandler(new Request("https://example.test/api/colleagues?ownerId=user-a"));
  expect(response.status).toBe(200);
  return ((await response.json()) as { days: SharedDay[] }).days;
};
const dayOf = (days: SharedDay[], date: string) => days.find((day) => day.date === date);

describe("semaine partagée : ce que le collègue enregistre se lit aussitôt", () => {
  beforeEach(() => {
    data.clear();
    mockedGetUser.mockReset();
    for (const [id, name] of [["user-a", "Alice"], ["user-b", "Benoît"]]) data.set(`colleagues/profile/${id}`, {
      userId: id, displayName: name, email: `${id}@example.test`, visible: true, updatedAt: "2026-11-01T10:00:00.000Z",
    });
    data.set("colleagues/share/viewer/user-b/user-a", {
      ownerId: "user-a", viewerId: "user-b", ownerName: "Alice", viewerName: "Benoît",
      status: "accepted", createdAt: "2026-11-01", updatedAt: "2026-11-01",
    });
    data.set("user/user-a/form-profile", { group: "2" });
  });

  it("dit EX, AC, BI, F, A et 1/2 (avec la moitié travaillée), et suit chaque changement", async () => {
    // Journées travaillées et de formation du groupe 2 sur trois mois (une
    // formation par cycle de 21 jours), hors férié et fermeture exceptionnelle.
    const closures = new Set(GRAND_PALAIS_EXCEPTIONAL_CLOSURES.map((closure) => closure.date));
    const work: string[] = [];
    const training: string[] = [];
    for (let day = new Date("2026-11-02T12:00:00"); day < new Date("2027-02-01T12:00:00"); day = addDays(day, 1)) {
      const info = getDayInfo(day, 2);
      if (info.holiday || closures.has(dateKey(day))) continue;
      if (info.kind === "work") work.push(dateKey(day));
      if (info.kind === "training") training.push(dateKey(day));
    }
    expect(work.length).toBeGreaterThanOrEqual(5);
    expect(training.length).toBeGreaterThanOrEqual(2);
    const [expo, counter, ticketing, absence, half] = work;
    const [trainingDay, trainingHalf] = training;

    await save({ action: "save-entry", date: counter, workPost: "counter" });
    await save({ action: "save-entry", date: ticketing, workPost: "ticketing" });
    await save({ action: "save-period", id: "ca-absence", from: absence, to: absence, leaveType: "annual", group: 2 });
    await save({ action: "save-entry", date: half, workPost: "counter" });
    await save({ action: "save-period", id: "half-morning", from: half, to: half, leaveType: "half", halfMoment: "morning", group: 2 });
    await save({ action: "save-period", id: "half-training", from: trainingHalf, to: trainingHalf, leaveType: "half", halfMoment: "afternoon", group: 2 });

    const days = await sharedDays();
    // Sans journée enregistrée, l'écran suit le cycle du groupe : EX et F.
    expect(dayOf(days, expo)).toBeUndefined();
    expect(getDayInfo(new Date(`${trainingDay}T12:00:00`), 2).kind).toBe("training");
    expect(dayOf(days, counter)).toMatchObject({ status: "work", workPost: "counter" });
    expect(dayOf(days, ticketing)).toMatchObject({ status: "work", workPost: "ticketing" });
    expect(dayOf(days, absence)).toEqual({ date: absence, status: "absence" });
    expect(dayOf(days, half)).toMatchObject({ status: "partial", halfMoment: "morning", workPost: "counter" });
    expect(dayOf(days, trainingHalf)).toMatchObject({ status: "partial", halfMoment: "afternoon" });
    // Aucun motif ne sort : ni « annual », ni identifiant de période.
    expect(JSON.stringify(days)).not.toMatch(/annual|ca-absence|half-morning/);

    // Le collègue change d'avis : la lecture suivante le montre, sans délai.
    await save({ action: "save-entry", date: counter, workPost: "ticketing" });
    // Retour en salle : la fiche du jour envoie un poste vide.
    await save({ action: "save-entry", date: ticketing, workPost: "" });
    await save({ action: "delete-period", id: "ca-absence" });
    await save({ action: "save-entry", date: expo, workPost: "counter" });
    const next = await sharedDays();
    expect(dayOf(next, counter)).toMatchObject({ status: "work", workPost: "ticketing" });
    expect(dayOf(next, ticketing)?.workPost ?? "").toBe("");
    expect(dayOf(next, absence)?.status ?? "work").toBe("work");
    expect(dayOf(next, expo)).toMatchObject({ status: "work", workPost: "counter" });
  });
});
