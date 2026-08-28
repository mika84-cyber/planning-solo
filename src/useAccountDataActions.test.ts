import type { Dispatch, SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createAccountBackup,
  useAccountDataActions,
  type AccountCalendarGet,
  type AccountCalendarPost,
} from "./useAccountDataActions";

function setter<T>() {
  return vi.fn<(value: SetStateAction<T>) => void>() as Dispatch<
    SetStateAction<T>
  >;
}

function actionsFixture(options?: {
  confirm?: boolean;
  prompt?: string | null;
  archived?: number;
}) {
  const payloads: Record<string, unknown>[] = [];
  const get: AccountCalendarGet = async <T>() => ({ entries: {} }) as T;
  const post: AccountCalendarPost = async <T = { ok: true }>(payload: Record<string, unknown>) => {
    payloads.push(payload);
    return {
      ok: true,
      archived: options?.archived ?? 0,
    } as T;
  };
  const notify = vi.fn();
  const loadCalendar = vi.fn().mockResolvedValue(undefined);
  const actions = useAccountDataActions({
    setBusy: setter<boolean>(),
    setOpen: setter<boolean>(),
    loadCalendar,
    notify,
    get,
    post,
    confirmAction: () => options?.confirm ?? true,
    promptAction: () => options?.prompt ?? null,
    downloadJson: vi.fn(),
    now: () => new Date(2026, 7, 29, 12),
  });
  return { actions, payloads, notify, loadCalendar };
}

describe("useAccountDataActions", () => {
  it("produit une sauvegarde versionnée sans inventer de données absentes", () => {
    expect(
      createAccountBackup(
        { entries: { "2026-08-29": { note: "test" } } },
        "2026-08-29T10:00:00.000Z",
      ),
    ).toEqual({
      version: 1,
      exported_at: "2026-08-29T10:00:00.000Z",
      entries: { "2026-08-29": { note: "test" } },
      periods: [],
      overtime_entries: [],
      recovery_uses: [],
      mecenat_entries: [],
      form_profile: null,
    });
  });

  it("archive seulement après confirmation avec le payload attendu", async () => {
    const { actions, payloads, notify } = actionsFixture({
      confirm: true,
      archived: 2,
    });
    await actions.archiveLegacyData();
    expect(payloads).toEqual([
      { action: "archive-legacy-data", confirmation: "ARCHIVER" },
    ]);
    expect(notify).toHaveBeenCalledWith(
      "2 éléments historiques archivés.",
    );
  });

  it("n’efface le compte qu’après la confirmation textuelle exacte", async () => {
    const refused = actionsFixture({ prompt: "supprimer" });
    await refused.actions.deleteAllUserData();
    expect(refused.payloads).toEqual([]);

    const accepted = actionsFixture({ prompt: "SUPPRIMER" });
    await accepted.actions.deleteAllUserData();
    expect(accepted.payloads).toEqual([
      { action: "delete-user-data", confirmation: "SUPPRIMER" },
    ]);
    expect(accepted.loadCalendar).toHaveBeenCalledOnce();
  });

  it("rejette une sauvegarde de plus de 5 Mo avant toute écriture", async () => {
    const { actions, payloads, notify } = actionsFixture();
    const oversizedFile = {
      size: 5_000_001,
      text: async () => "{}",
    } as File;
    await actions.importDataBackup(oversizedFile);
    expect(payloads).toEqual([]);
    expect(notify).toHaveBeenCalledWith(
      "Cette sauvegarde dépasse la taille maximale de 5 Mo.",
    );
  });
});
