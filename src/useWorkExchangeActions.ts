import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Entries, LeavePeriod, WorkExchange } from "./appModel";
import { emptyEntry } from "./appModel";
import { calendarErrorMessage, postCalendar } from "./calendarApi";
import type { RecoveryUse } from "./overtime";
import { fromKey, getDayInfo } from "./planningLogic";
import {
  emptyWorkExchangeDraft,
  exchangeDraftFromExchange,
  validateWorkExchange,
  workExchangesFromEntries,
  type WorkExchangeDraft,
} from "./workExchange";

type ApiEntryResult = { date: string; updatedAt: string; deleted: boolean };

type Options = {
  group: number;
  entries: Entries;
  setEntries: Dispatch<SetStateAction<Entries>>;
  periods: LeavePeriod[];
  recoveryUses: RecoveryUse[];
  demoMode: boolean;
  isExceptionallyClosed: (date: string) => boolean;
  showSuccess: (message: string) => void;
  confirmAction?: (message: string) => boolean;
};

function clearExchangeFields(entry: ReturnType<typeof emptyEntry>) {
  const next = { ...entry };
  delete next.exchangeId;
  delete next.exchangeRole;
  delete next.exchangePartner;
  delete next.exchangePartnerGroup;
  delete next.exchangeOtherDate;
  return next;
}

export function useWorkExchangeActions({
  group,
  entries,
  setEntries,
  periods,
  recoveryUses,
  demoMode,
  isExceptionallyClosed,
  showSuccess,
  confirmAction = (message) => window.confirm(message),
}: Options) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkExchangeDraft>(() => emptyWorkExchangeDraft(group));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const exchanges = useMemo(() => workExchangesFromEntries(entries), [entries]);

  function openNew(agreementDate = "") {
    const next = emptyWorkExchangeDraft(group);
    if (agreementDate) {
      const kind = getDayInfo(fromKey(agreementDate), group).kind;
      if (kind === "work") next.agreementDate = agreementDate;
      else if (kind === "off") next.returnDate = agreementDate;
    }
    setDraft(next);
    setError("");
    setOpen(true);
  }

  function openEdit(exchange: WorkExchange) {
    setDraft(exchangeDraftFromExchange(exchange));
    setError("");
    setOpen(true);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    setError("");
  }

  function applyExchange(
    current: Entries,
    nextDraft: WorkExchangeDraft | null,
    previous: WorkExchange | undefined,
    results: ApiEntryResult[],
  ) {
    const next = { ...current };
    const affected = new Set([
      previous?.agreementDate,
      previous?.returnDate,
      nextDraft?.agreementDate,
      nextDraft?.returnDate,
    ].filter((date): date is string => Boolean(date)));
    for (const date of affected) {
      const result = results.find((item) => item.date === date);
      if (result?.deleted) {
        delete next[date];
        continue;
      }
      next[date] = {
        ...clearExchangeFields(next[date] || emptyEntry()),
        updatedAt: result?.updatedAt || new Date().toISOString(),
      };
    }
    if (nextDraft) {
      const common = {
        exchangeId: nextDraft.id,
        exchangePartner: nextDraft.partnerName.trim(),
        exchangePartnerGroup: nextDraft.partnerGroup,
      };
      next[nextDraft.agreementDate] = {
        ...next[nextDraft.agreementDate], ...common,
        exchangeRole: "given", exchangeOtherDate: nextDraft.returnDate,
      };
      next[nextDraft.returnDate] = {
        ...next[nextDraft.returnDate], ...common,
        exchangeRole: "return", exchangeOtherDate: nextDraft.agreementDate,
      };
    }
    return next;
  }

  async function save() {
    const occupiedDates = new Set<string>();
    for (const period of periods)
      for (const date of [draft.agreementDate, draft.returnDate])
        if (date && date >= period.from && date <= period.to) occupiedDates.add(date);
    for (const date of [draft.agreementDate, draft.returnDate]) {
      if (!date) continue;
      if (entries[date]?.leave || entries[date]?.wish || recoveryUses.some((item) => item.date === date))
        occupiedDates.add(date);
    }
    const validationError = validateWorkExchange(draft, {
      group, entries, occupiedDates, isExceptionallyClosed,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    const previous = draft.id ? exchanges.find((item) => item.id === draft.id) : undefined;
    const nextDraft = { ...draft, id: draft.id || crypto.randomUUID() };
    const affected = [...new Set([
      previous?.agreementDate, previous?.returnDate,
      nextDraft.agreementDate, nextDraft.returnDate,
    ].filter((date): date is string => Boolean(date)))];
    setSaving(true);
    setError("");
    try {
      const result = demoMode
        ? { entries: affected.map((date) => ({ date, updatedAt: new Date().toISOString(), deleted: false })) }
        : await postCalendar<{ ok: true; entries: ApiEntryResult[] }>({
            action: "save-exchange",
            id: nextDraft.id,
            partnerName: nextDraft.partnerName,
            partnerGroup: nextDraft.partnerGroup,
            agreementDate: nextDraft.agreementDate,
            returnDate: nextDraft.returnDate,
            previousAgreementDate: previous?.agreementDate || "",
            previousReturnDate: previous?.returnDate || "",
            expectedUpdatedAts: Object.fromEntries(
              affected.map((date) => [date, entries[date]?.updatedAt || ""]),
            ),
          });
      setEntries((current) => applyExchange(current, nextDraft, previous, result.entries));
      setOpen(false);
      showSuccess(previous ? "L’échange a été modifié sur ses deux dates." : "L’échange a été enregistré sur ses deux dates.");
    } catch (caught) {
      setError(calendarErrorMessage(caught, "L’échange n’a pas pu être enregistré."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const previous = exchanges.find((item) => item.id === draft.id);
    if (!previous || (!demoMode && !confirmAction("Supprimer les deux journées de cet échange ?"))) return;
    const affected = [previous.agreementDate, previous.returnDate];
    setSaving(true);
    setError("");
    try {
      const result = demoMode
        ? { entries: affected.map((date) => ({ date, updatedAt: "", deleted: true })) }
        : await postCalendar<{ ok: true; entries: ApiEntryResult[] }>({
            action: "delete-exchange",
            id: previous.id,
            agreementDate: previous.agreementDate,
            returnDate: previous.returnDate,
            expectedUpdatedAts: Object.fromEntries(
              affected.map((date) => [date, entries[date]?.updatedAt || ""]),
            ),
          });
      setEntries((current) => applyExchange(current, null, previous, result.entries));
      setOpen(false);
      showSuccess("Les deux journées de l’échange ont été supprimées.");
    } catch (caught) {
      setError(calendarErrorMessage(caught, "L’échange n’a pas pu être supprimé."));
    } finally {
      setSaving(false);
    }
  }

  return {
    open, draft, setDraft, error, saving, exchanges,
    openNew, openEdit, close, save, remove,
  };
}
