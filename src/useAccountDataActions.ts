import type { Dispatch, SetStateAction } from "react";
import { calendarErrorMessage } from "./calendarApi";
import { dateKey } from "./planningLogic";

type SetState<T> = Dispatch<SetStateAction<T>>;

export type AccountDataSnapshot = {
  entries?: unknown[] | Record<string, unknown>;
  periods?: unknown[];
  overtime_entries?: unknown[];
  recovery_uses?: unknown[];
  mecenat_entries?: unknown[];
  form_profile?: unknown;
};

export type AccountBackup = {
  version: 1;
  exported_at: string;
  entries: unknown[] | Record<string, unknown>;
  periods: unknown[];
  overtime_entries: unknown[];
  recovery_uses: unknown[];
  mecenat_entries: unknown[];
  form_profile: unknown;
};

export type AccountCalendarGet = <T>() => Promise<T>;
export type AccountCalendarPost = <T = { ok: true }>(
  payload: Record<string, unknown>,
) => Promise<T>;

type AccountDataActionsOptions = {
  setBusy: SetState<boolean>;
  setOpen: SetState<boolean>;
  loadCalendar: () => Promise<void>;
  notify: (message: string) => void;
  get: AccountCalendarGet;
  post: AccountCalendarPost;
  confirmAction?: (message: string) => boolean;
  promptAction?: (message: string) => string | null;
  downloadJson?: (filename: string, content: string) => void;
  now?: () => Date;
};

export function createAccountBackup(
  data: AccountDataSnapshot,
  exportedAt: string,
): AccountBackup {
  return {
    version: 1,
    exported_at: exportedAt,
    entries: data.entries || [],
    periods: data.periods || [],
    overtime_entries: data.overtime_entries || [],
    recovery_uses: data.recovery_uses || [],
    mecenat_entries: data.mecenat_entries || [],
    form_profile: data.form_profile || null,
  };
}

function browserDownloadJson(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useAccountDataActions({
  setBusy,
  setOpen,
  loadCalendar,
  notify,
  get,
  post,
  confirmAction = (message) => window.confirm(message),
  promptAction = (message) => window.prompt(message),
  downloadJson = browserDownloadJson,
  now = () => new Date(),
}: AccountDataActionsOptions) {
  async function exportDataBackup() {
    setBusy(true);
    try {
      const data = await get<AccountDataSnapshot>();
      const exportDate = now();
      const backup = createAccountBackup(data, exportDate.toISOString());
      downloadJson(
        `planning-solo-sauvegarde-${dateKey(exportDate)}.json`,
        JSON.stringify(backup, null, 2),
      );
      notify("La sauvegarde JSON a été téléchargée.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La sauvegarde n’a pas pu être créée."));
    } finally {
      setBusy(false);
    }
  }

  async function importDataBackup(file: File) {
    if (file.size > 5_000_000) {
      notify("Cette sauvegarde dépasse la taille maximale de 5 Mo.");
      return;
    }
    if (
      !confirmAction(
        "Restaurer cette sauvegarde remplacera le planning et le profil actuels. Continuer ?",
      )
    )
      return;
    setBusy(true);
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      await post({ action: "restore-backup", backup });
      await loadCalendar();
      setOpen(false);
      notify("La sauvegarde a été restaurée.");
    } catch (error) {
      notify(calendarErrorMessage(error, "La sauvegarde est invalide ou illisible."));
    } finally {
      setBusy(false);
    }
  }

  async function archiveLegacyData() {
    if (
      !confirmAction(
        "Archiver les anciennes clés globales dans votre espace privé ? Une copie récupérable sera conservée.",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await post<{ ok: true; archived: number }>({
        action: "archive-legacy-data",
        confirmation: "ARCHIVER",
      });
      notify(
        result.archived
          ? `${result.archived} élément${result.archived > 1 ? "s" : ""} historique${result.archived > 1 ? "s" : ""} archivé${result.archived > 1 ? "s" : ""}.`
          : "Aucune ancienne donnée ne restait à archiver.",
      );
    } catch (error) {
      notify(calendarErrorMessage(error, "L’archivage n’a pas pu être effectué."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAllUserData() {
    const confirmation = promptAction(
      "Cette action efface le planning, le profil et les paramètres de paie. Tapez SUPPRIMER pour confirmer.",
    );
    if (confirmation !== "SUPPRIMER") return;
    setBusy(true);
    try {
      await post({ action: "delete-user-data", confirmation });
      await loadCalendar();
      setOpen(false);
      notify("Toutes les données du compte ont été effacées.");
    } catch (error) {
      notify(calendarErrorMessage(error, "Les données n’ont pas pu être effacées."));
    } finally {
      setBusy(false);
    }
  }

  return {
    exportDataBackup,
    importDataBackup,
    archiveLegacyData,
    deleteAllUserData,
  };
}
