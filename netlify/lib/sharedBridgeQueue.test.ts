import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_PAUSE_KEY, PENDING_BRIDGE_PREFIX, deliverSharedOperations } from "./sharedBridgeQueue.mts";

const data = new Map<string, unknown>();
const etagFor = (key: string) => data.has(key) ? `etag:${JSON.stringify(data.get(key))}` : "";
const store = {
  get: vi.fn(async (key: string) => data.get(key) ?? null),
  getWithMetadata: vi.fn(async (key: string) => data.has(key) ? { data: data.get(key), etag: etagFor(key) } : null),
  setJSON: vi.fn(async (key: string, value: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) => {
    if (options?.onlyIfNew && data.has(key)) return { modified: false };
    if (options?.onlyIfMatch && options.onlyIfMatch !== etagFor(key)) return { modified: false };
    data.set(key, value);
    return { modified: true, etag: etagFor(key) };
  }),
  delete: vi.fn(async (key: string) => { data.delete(key); }),
  list: vi.fn(({ prefix }: { prefix: string }) => ({
    async *[Symbol.asyncIterator]() {
      yield { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    },
  })),
} as unknown as Parameters<typeof deliverSharedOperations>[0];
type Operation = Record<string, unknown>;
const scopedKey = (key: string) => `user/mika/${key}`;
const pending = () => [...data.entries()]
  .filter(([key]) => key.startsWith(scopedKey(PENDING_BRIDGE_PREFIX)))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, value]) => (value as { operation: { action: string; from?: string } }).operation);
const note = (date: string) => ({ action: "bridge-save-mika-note", from: date, to: date, noteText: "Note" });

beforeEach(() => {
  data.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
  Object.defineProperty(globalThis, "Netlify", {
    configurable: true,
    value: { env: { get: (key: string) => key === "PLANNING_SHARED_BRIDGE_SECRET" ? "secret-de-test" : undefined } },
  });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "Netlify");
});

describe("copies en attente vers le planning d’Agnès", () => {
  it("envoie tout de suite, sans rien garder, quand Agnès répond", async () => {
    const send = vi.fn(async (_operation: Operation) => "sent" as const);
    await expect(deliverSharedOperations(store, scopedKey, [note("2026-10-20"), note("2026-10-21")], send)).resolves.toBe("shared");
    expect(send.mock.calls.map(([operation]) => operation.from)).toEqual(["2026-10-20", "2026-10-21"]);
    expect(pending()).toEqual([]);
  });

  it("garde les copies manquées, attend deux minutes, puis les renvoie dans l’ordre", async () => {
    const down = vi.fn(async (_operation: Operation) => "retry" as const);
    await expect(deliverSharedOperations(store, scopedKey, [note("2026-10-20"), note("2026-10-21")], down)).resolves.toBe("pending");
    expect(down).toHaveBeenCalledTimes(1);
    expect(pending().map((operation) => operation.from)).toEqual(["2026-10-20", "2026-10-21"]);

    // Pendant la pause, une nouvelle note attend derrière les autres, sans essai.
    vi.setSystemTime(new Date("2026-10-19T10:01:00Z"));
    await expect(deliverSharedOperations(store, scopedKey, [note("2026-10-22")], down)).resolves.toBe("pending");
    expect(down).toHaveBeenCalledTimes(1);
    expect(pending().map((operation) => operation.from)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);

    // Agnès répond de nouveau : à l’ouverture suivante, tout part dans l’ordre.
    vi.setSystemTime(new Date("2026-10-19T10:03:00Z"));
    const up = vi.fn(async (_operation: Operation) => "sent" as const);
    await expect(deliverSharedOperations(store, scopedKey, [], up)).resolves.toBe("shared");
    expect(up.mock.calls.map(([operation]) => operation.from)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(pending()).toEqual([]);
    expect(data.has(scopedKey(BRIDGE_PAUSE_KEY))).toBe(false);
  });

  it("abandonne une copie refusée pour de bon et continue", async () => {
    const send = vi.fn(async (operation: Record<string, unknown>) => operation.from === "2026-10-20" ? "rejected" as const : "sent" as const);
    await expect(deliverSharedOperations(store, scopedKey, [note("2026-10-20"), note("2026-10-21")], send)).resolves.toBe("shared");
    expect(send).toHaveBeenCalledTimes(2);
    expect(pending()).toEqual([]);
  });

  it("ne renvoie que la dernière reprise des congés", async () => {
    const sync = (id: string) => ({ action: "bridge-sync-mika-calendar", awayDates: [], awayPeriods: [{ id }] });
    await deliverSharedOperations(store, scopedKey, [sync("ancienne")], vi.fn(async (_operation: Operation) => "retry" as const));
    vi.setSystemTime(new Date("2026-10-19T10:05:00Z"));
    const send = vi.fn(async (_operation: Operation) => "sent" as const);
    await deliverSharedOperations(store, scopedKey, [note("2026-10-20"), sync("recente")], send);
    expect(send.mock.calls.map(([operation]) => operation.action === "bridge-sync-mika-calendar"
      ? (operation.awayPeriods as Array<{ id: string }>)[0].id
      : operation.from)).toEqual(["2026-10-20", "recente"]);
  });

  it("ne garde rien sans liaison configurée", async () => {
    Reflect.deleteProperty(globalThis, "Netlify");
    const send = vi.fn(async (_operation: Operation) => "sent" as const);
    await expect(deliverSharedOperations(store, scopedKey, [note("2026-10-20")], send)).resolves.toBe("disabled");
    expect(send).not.toHaveBeenCalled();
    expect(pending()).toEqual([]);
  });
});
