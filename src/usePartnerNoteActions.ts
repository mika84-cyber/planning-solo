import type { Dispatch, SetStateAction } from "react";
import { noteDateLabel, type PartnerCalendarEntries } from "./appModel";
import { calendarErrorMessage } from "./calendarApi";
import type { PayCalendarPost } from "./usePayActions";
import { browserConfirm, type ConfirmAction } from "./confirmDialog";

type PartnerNoteActionsOptions = {
  demoMode: boolean;
  partnerEntries: PartnerCalendarEntries;
  setPartnerEntries: Dispatch<SetStateAction<PartnerCalendarEntries>>;
  reloadCalendar: () => Promise<void>;
  notify: (message: string) => void;
  confirmAction?: ConfirmAction;
  post: PayCalendarPost;
};

/** Les notes d'Agnès partagées sur le planning : leur suppression, sur toute
 *  la période d'une note posée sur plusieurs jours. */
export function usePartnerNoteActions({
  demoMode,
  partnerEntries,
  setPartnerEntries,
  reloadCalendar,
  notify,
  confirmAction = browserConfirm,
  post,
}: PartnerNoteActionsOptions) {
  async function deleteAgnesNote(date: string) {
      const partnerEntry = partnerEntries[date];
      if (!partnerEntry?.noteText) return;
      const groupedDates = partnerEntry.noteGroupId
        ? Object.entries(partnerEntries)
            .filter(([, entry]) => entry.noteGroupId === partnerEntry.noteGroupId && Boolean(entry.noteText))
            .map(([key]) => key)
        : [date];
      const periodLabel = groupedDates.length > 1 ? " sur toute sa période" : "";
      if (!(await confirmAction({
        title: `Supprimer la note d’Agnès du ${noteDateLabel(date)}${periodLabel} ?`,
        confirmLabel: "Supprimer",
        tone: "danger",
      }))) return;
      try {
        if (!demoMode) {
          await post({
            action: "delete-shared-partner-note",
            date,
            groupId: partnerEntry.noteGroupId || undefined,
          });
          await reloadCalendar();
        } else {
          setPartnerEntries((current) => {
            const next = { ...current };
            for (const key of groupedDates) {
              const entry = next[key];
              if (!entry) continue;
              next[key] = { ...entry, noteText: "", noteGroupId: "" };
            }
            return next;
          });
        }
      } catch (error) {
        notify(calendarErrorMessage(error, "La note d’Agnès n’a pas pu être supprimée."));
      }
  }

  return { deleteAgnesNote };
}
