import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Entries, FormProfile, LeavePeriod, WorkExchange } from "./appModel";
import { emptyEntry } from "./appModel";
import { calendarErrorMessage, postCalendar } from "./calendarApi";
import { findColleagueAccount } from "./colleagueNames";
import { getColleagueDirectory, updateColleagueSharing } from "./colleagueSharingApi";
import type { RecoveryUse } from "./overtime";
import { fromKey, getDayInfo } from "./planningLogic";
import {
  emptyWorkExchangeDraft,
  exchangeDraftFromExchange,
  exchangeEntryFields,
  validateWorkExchange,
  workExchangesFromEntries,
  type WorkExchangeDraft,
} from "./workExchange";

type ApiEntryResult = { date: string; updatedAt: string; deleted: boolean };

export const EXCHANGE_HANDOFF_KEY = "planning:exchange-handoff-v1";
/* La démo garde ses échanges le temps de l'onglet : le formulaire s'ouvre
   dans la même page et l'échange doit être là au retour. */
export const DEMO_EXCHANGES_KEY = "planning:demo-exchanges-v1";
type StoredExchange = Pick<WorkExchangeDraft, "id" | "partnerName" | "partnerGroup" | "agreementDate" | "returnDate">
  & Partial<Pick<WorkExchangeDraft, "agreementStart" | "agreementEnd" | "returnStart" | "returnEnd">>;

export function readDemoExchanges(): StoredExchange[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(DEMO_EXCHANGES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function storeDemoExchange(id: string, exchange: StoredExchange | null) {
  try {
    const rest = readDemoExchanges().filter((item) => item.id !== id);
    sessionStorage.setItem(DEMO_EXCHANGES_KEY, JSON.stringify(exchange ? [...rest, exchange] : rest));
  } catch {}
}

type Options = {
  group: number;
  entries: Entries;
  setEntries: Dispatch<SetStateAction<Entries>>;
  periods: LeavePeriod[];
  recoveryUses: RecoveryUse[];
  demoMode: boolean;
  isExceptionallyClosed: (date: string) => boolean;
  showSuccess: (message: string) => void;
  confirmAction?: (message: string) => boolean | Promise<boolean>;
  formProfile?: FormProfile | null;
  userEmail?: string;
  /** Ouvre la demande d'échange préremplie ; remplaçable dans les tests. */
  openForm?: () => void;
};

function clearExchangeFields(entry: ReturnType<typeof emptyEntry>) {
  const next = { ...entry };
  delete next.exchangeId;
  delete next.exchangeRole;
  delete next.exchangePartner;
  delete next.exchangePartnerGroup;
  delete next.exchangeOtherDate;
  delete next.exchangeStart;
  delete next.exchangeEnd;
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
  formProfile = null,
  userEmail = "",
  openForm = () => window.location.assign("/formulaire/index.html?echange=1"),
}: Options) {
  const schedule = formProfile?.workSchedule;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkExchangeDraft>(() => emptyWorkExchangeDraft(group));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const exchanges = useMemo(() => workExchangesFromEntries(entries), [entries]);

  function openNew(agreementDate = "") {
    const next = emptyWorkExchangeDraft(group, "", schedule);
    if (agreementDate) {
      const kind = getDayInfo(fromKey(agreementDate), group).kind;
      if (kind === "work" || kind === "training") {
        next.agreementDate = agreementDate;
        // Le collègue doit être en repos ce jour-là (au travail pour une
        // formation cédée) : son groupe est connu.
        const wanted = kind === "training" ? "work" : "off";
        const offGroup = [1, 2, 3].find((other) => other !== group && getDayInfo(fromKey(agreementDate), other).kind === wanted);
        if (offGroup) next.partnerGroup = offGroup;
      }
      else if (kind === "off") next.returnDate = agreementDate;
    }
    setDraft(next);
    setError("");
    setOpen(true);
  }

  function openEdit(exchange: WorkExchange) {
    setDraft(exchangeDraftFromExchange(exchange, schedule));
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
    if (nextDraft)
      for (const [date, fields] of Object.entries(exchangeEntryFields(nextDraft)))
        next[date] = { ...next[date], ...fields };
    return next;
  }

  /** Enregistre l'échange ; `fillForm` ouvre ensuite la demande préremplie. */
  async function save(fillForm = true) {
    // Hors d'un férié, ou avec un férié rendu, ce n'est pas un remplacement seul.
    const replacement = Boolean(draft.replacement);
    const dated = replacement ? { ...draft, returnDate: "" } : draft;
    const occupiedDates = new Set<string>();
    for (const period of periods)
      for (const date of [dated.agreementDate, dated.returnDate])
        if (date && date >= period.from && date <= period.to) occupiedDates.add(date);
    for (const date of [dated.agreementDate, dated.returnDate]) {
      if (!date) continue;
      if (entries[date]?.leave || entries[date]?.wish || recoveryUses.some((item) => item.date === date))
        occupiedDates.add(date);
    }
    const validationError = validateWorkExchange(dated, {
      group, entries, occupiedDates, isExceptionallyClosed,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (replacement ? !(draft.agreementStart && draft.agreementEnd)
      : ![draft.agreementStart, draft.agreementEnd, draft.returnStart, draft.returnEnd].every(Boolean)) {
      setError(replacement ? "Indiquez vos horaires ce jour-là." : "Indiquez les horaires des deux journées.");
      return;
    }
    const previous = draft.id ? exchanges.find((item) => item.id === draft.id) : undefined;
    const nextDraft = { ...dated, id: draft.id || crypto.randomUUID() };
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
            agreementStart: nextDraft.agreementStart,
            agreementEnd: nextDraft.agreementEnd,
            returnStart: nextDraft.returnDate ? nextDraft.returnStart : "",
            returnEnd: nextDraft.returnDate ? nextDraft.returnEnd : "",
            previousAgreementDate: previous?.agreementDate || "",
            previousReturnDate: previous?.returnDate || "",
            expectedUpdatedAts: Object.fromEntries(
              affected.map((date) => [date, entries[date]?.updatedAt || ""]),
            ),
          });
      setEntries((current) => applyExchange(current, nextDraft, previous, result.entries));
      setOpen(false);
      showSuccess(replacement
        ? previous ? "Le remplacement a été modifié." : "Le remplacement a été enregistré."
        : previous ? "L’échange a été modifié sur ses deux dates." : "L’échange a été enregistré sur ses deux dates.");
      const { id, partnerName, partnerGroup, agreementDate, returnDate, agreementStart, agreementEnd, returnStart, returnEnd } = nextDraft;
      if (demoMode) storeDemoExchange(id, { id, partnerName, partnerGroup, agreementDate, returnDate, agreementStart, agreementEnd, returnStart, returnEnd });
      /* Le collègue a un compte dans l'annuaire : l'échange lui est proposé,
         pour qu'il l'accepte d'un geste et l'ait dans son planning. */
      if (!demoMode && returnDate) await proposeToColleague(nextDraft).catch(() => undefined);
      /* La demande s'ouvre aussitôt, remplie avec ces dates : la demande
         d'échange, ou pour un férié la demande de remplacement. Sans elle,
         l'échange reste enregistré dans le planning. */
      if (fillForm) try {
        localStorage.setItem(EXCHANGE_HANDOFF_KEY, JSON.stringify({
          version: 1,
          sheet: getDayInfo(fromKey(agreementDate), group).holiday ? "ferie" : "echange",
          ownerKey: userEmail.trim().toLowerCase(),
          profile: { fullName: formProfile?.fullName || "", group: String(group), signature: formProfile?.signature || "" },
          ...nextDraft,
          partnerName: partnerName.trim(),
        }));
        openForm();
      } catch {}
    } catch (caught) {
      setError(calendarErrorMessage(caught, "L’échange n’a pas pu être enregistré."));
    } finally {
      setSaving(false);
    }
  }

  async function proposeToColleague(saved: WorkExchangeDraft) {
    const directory = await getColleagueDirectory();
    const account = findColleagueAccount(saved.partnerName, directory.directory);
    if (!account) return;
    await updateColleagueSharing({
      action: "propose-exchange", id: saved.id, partnerId: account.userId, group,
      agreementDate: saved.agreementDate, returnDate: saved.returnDate,
      agreementStart: saved.agreementStart, agreementEnd: saved.agreementEnd,
      returnStart: saved.returnStart, returnEnd: saved.returnEnd,
    });
  }

  async function remove() {
    const previous = exchanges.find((item) => item.id === draft.id);
    if (!previous || (!demoMode && !(await confirmAction(previous.returnDate ? "Supprimer les deux journées de cet échange ?" : "Supprimer ce remplacement ?")))) return;
    const affected = [previous.agreementDate, previous.returnDate].filter(Boolean);
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
      if (demoMode) storeDemoExchange(previous.id, null);
      setOpen(false);
      showSuccess(previous.returnDate ? "Les deux journées de l’échange ont été supprimées." : "Le remplacement a été supprimé.");
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
