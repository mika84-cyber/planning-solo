import type { Entries, WorkExchange } from "./appModel";
import { fromKey, getDayInfo } from "./planningLogic";

export const WORK_EXCHANGE_COLOR = "#5EB6C4";

export type WorkExchangeDraft = {
  id: string;
  partnerName: string;
  partnerGroup: number;
  agreementDate: string;
  returnDate: string;
};

export function emptyWorkExchangeDraft(group: number, agreementDate = ""): WorkExchangeDraft {
  return {
    id: "",
    partnerName: "",
    partnerGroup: group === 1 ? 2 : 1,
    agreementDate,
    returnDate: "",
  };
}

export function workExchangeForDate(entries: Entries, date: string): WorkExchange | null {
  const entry = entries[date];
  if (
    !entry?.exchangeId ||
    !entry.exchangeRole ||
    !entry.exchangePartner ||
    !entry.exchangePartnerGroup ||
    !entry.exchangeOtherDate
  ) return null;
  return {
    id: entry.exchangeId,
    partnerName: entry.exchangePartner,
    partnerGroup: entry.exchangePartnerGroup,
    agreementDate: entry.exchangeRole === "given" ? date : entry.exchangeOtherDate,
    returnDate: entry.exchangeRole === "return" ? date : entry.exchangeOtherDate,
    updatedAt: entry.updatedAt,
  };
}

export function workExchangesFromEntries(entries: Entries): WorkExchange[] {
  return Object.entries(entries)
    .filter(([, entry]) => entry.exchangeRole === "given")
    .flatMap(([date]) => {
      const exchange = workExchangeForDate(entries, date);
      return exchange ? [exchange] : [];
    })
    .sort((a, b) => b.agreementDate.localeCompare(a.agreementDate));
}

type ValidationContext = {
  group: number;
  entries: Entries;
  occupiedDates: Set<string>;
  isExceptionallyClosed: (date: string) => boolean;
};

export function validateWorkExchange(
  draft: WorkExchangeDraft,
  { group, entries, occupiedDates, isExceptionallyClosed }: ValidationContext,
) {
  const partnerName = draft.partnerName.trim();
  if (!partnerName) return "Indiquez le nom du collègue.";
  if (partnerName.length > 80) return "Le nom du collègue est trop long.";
  if (![1, 2, 3].includes(draft.partnerGroup) || draft.partnerGroup === group)
    return "Choisissez le groupe du collègue.";
  if (!draft.agreementDate || !draft.returnDate)
    return "Les deux dates de l’échange sont obligatoires.";
  if (draft.returnDate === draft.agreementDate)
    return "Choisissez deux journées différentes pour l’échange.";

  const agreementMine = getDayInfo(fromKey(draft.agreementDate), group).kind;
  const agreementPartner = getDayInfo(fromKey(draft.agreementDate), draft.partnerGroup).kind;
  if (agreementMine !== "work" || agreementPartner !== "off")
    return "Pour la journée de votre cycle, vous devez travailler et votre collègue doit être en repos.";

  const returnMine = getDayInfo(fromKey(draft.returnDate), group).kind;
  const returnPartner = getDayInfo(fromKey(draft.returnDate), draft.partnerGroup).kind;
  if (returnMine !== "off" || returnPartner !== "work")
    return "Pour la journée du cycle du collègue, vous devez être en repos et votre collègue doit travailler.";

  for (const date of [draft.agreementDate, draft.returnDate]) {
    if (isExceptionallyClosed(date))
      return "Un échange est impossible pendant une fermeture exceptionnelle.";
    const otherExchange = entries[date]?.exchangeId;
    if (otherExchange && otherExchange !== draft.id)
      return "Une des dates appartient déjà à un autre échange.";
    if (occupiedDates.has(date))
      return "Une des dates comporte déjà un congé ou une récupération.";
  }
  return "";
}

export function exchangeDraftFromExchange(exchange: WorkExchange): WorkExchangeDraft {
  return {
    id: exchange.id,
    partnerName: exchange.partnerName,
    partnerGroup: exchange.partnerGroup,
    agreementDate: exchange.agreementDate,
    returnDate: exchange.returnDate,
  };
}
