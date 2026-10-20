import type { Entries, WorkExchange } from "./appModel";
import { addDays, dateKey, fromKey, getDayInfo } from "./planningLogic";

export type WorkExchangeDraft = {
  id: string;
  partnerName: string;
  partnerGroup: number;
  agreementDate: string;
  returnDate: string;
  /** Horaires de chaque journée, repris sur la demande d'échange et
   *  enregistrés avec elle ; le profil les propose pour un nouvel échange. */
  agreementStart: string;
  agreementEnd: string;
  returnStart: string;
  returnEnd: string;
  /** Remplacement seul d'un férié : le collègue travaille votre férié, sans
   *  férié rendu. L'échange n'a alors qu'une date. */
  replacement?: boolean;
};

type Schedule = { start?: string; end?: string } | undefined;

function scheduleHours(schedule: Schedule) {
  const start = schedule?.start || "", end = schedule?.end || "";
  return { agreementStart: start, agreementEnd: end, returnStart: start, returnEnd: end };
}

export function emptyWorkExchangeDraft(group: number, agreementDate = "", schedule?: Schedule): WorkExchangeDraft {
  return {
    id: "",
    partnerName: "",
    partnerGroup: group === 1 ? 2 : 1,
    agreementDate,
    returnDate: "",
    ...scheduleHours(schedule),
  };
}

/** Les fériés à venir que vous travaillez alors qu'un autre groupe est en
 *  repos : ceux que vous pouvez céder dans un échange de férié. */
export function holidaysForExchangeGive(group: number, from: Date) {
  const holidays: Array<{ key: string; name: string; partnerGroup: number }> = [];
  for (let offset = 0; offset < 366; offset++) {
    const date = addDays(from, offset);
    const mine = getDayInfo(date, group);
    const partnerGroup = [1, 2, 3].find((other) => other !== group && getDayInfo(date, other).kind === "off");
    if (mine.holiday && mine.kind === "work" && partnerGroup)
      holidays.push({ key: dateKey(date), name: mine.holiday, partnerGroup });
  }
  return holidays;
}

/** Échange de formations : votre mercredi de formation cédé (vous
 *  travaillez) ou celui du collègue repris (vous suivez sa formation). */
export function isTrainingExchange(exchange: Pick<WorkExchange, "agreementDate">, group: number) {
  return getDayInfo(fromKey(exchange.agreementDate), group).kind === "training";
}

export function workExchangeForDate(entries: Entries, date: string): WorkExchange | null {
  const entry = entries[date];
  if (
    !entry?.exchangeId ||
    !entry.exchangeRole ||
    !entry.exchangePartner ||
    !entry.exchangePartnerGroup ||
    // Seul un remplacement (journée cédée) peut n'avoir qu'une date.
    (!entry.exchangeOtherDate && entry.exchangeRole !== "given")
  ) return null;
  return {
    id: entry.exchangeId,
    partnerName: entry.exchangePartner,
    partnerGroup: entry.exchangePartnerGroup,
    agreementDate: entry.exchangeRole === "given" ? date : entry.exchangeOtherDate || "",
    returnDate: entry.exchangeRole === "return" ? date : entry.exchangeOtherDate || "",
    ...exchangeHoursFromEntries(
      entries,
      entry.exchangeRole === "given" ? date : entry.exchangeOtherDate || "",
      entry.exchangeRole === "return" ? date : entry.exchangeOtherDate || "",
    ),
    updatedAt: entry.updatedAt,
  };
}

/** Les horaires enregistrés sur chacune des deux journées. */
function exchangeHoursFromEntries(entries: Entries, agreementDate: string, returnDate: string) {
  const given = agreementDate ? entries[agreementDate] : undefined;
  const back = returnDate ? entries[returnDate] : undefined;
  return {
    agreementStart: given?.exchangeStart || "",
    agreementEnd: given?.exchangeEnd || "",
    returnStart: back?.exchangeStart || "",
    returnEnd: back?.exchangeEnd || "",
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
  if (draft.replacement) {
    if (!draft.agreementDate) return "Choisissez le férié où votre collègue vous remplace.";
    const mine = getDayInfo(fromKey(draft.agreementDate), group);
    if (!mine.holiday) return "Un remplacement seul ne concerne qu’un jour férié.";
    if (mine.kind !== "work" || getDayInfo(fromKey(draft.agreementDate), draft.partnerGroup).kind !== "off")
      return "Pour ce férié, vous devez travailler et votre collègue doit être en repos.";
    if (isExceptionallyClosed(draft.agreementDate))
      return "Un remplacement est impossible pendant une fermeture exceptionnelle.";
    const otherExchange = entries[draft.agreementDate]?.exchangeId;
    if (otherExchange && otherExchange !== draft.id)
      return "Ce férié appartient déjà à un autre échange.";
    if (occupiedDates.has(draft.agreementDate))
      return "Ce férié comporte déjà un congé ou une récupération.";
    return "";
  }
  if (!draft.agreementDate || !draft.returnDate)
    return "Les deux dates de l’échange sont obligatoires.";
  if (draft.returnDate === draft.agreementDate)
    return "Choisissez deux journées différentes pour l’échange.";

  const agreementMine = getDayInfo(fromKey(draft.agreementDate), group).kind;
  const agreementPartner = getDayInfo(fromKey(draft.agreementDate), draft.partnerGroup).kind;
  const returnMine = getDayInfo(fromKey(draft.returnDate), group).kind;
  const returnPartner = getDayInfo(fromKey(draft.returnDate), draft.partnerGroup).kind;
  // Un mercredi de formation s'échange contre un mercredi de formation : chacun
  // suit la formation de l'autre et travaille à sa place le jour de la sienne.
  if (agreementMine === "training") {
    if (agreementPartner !== "work")
      return "Pour votre mercredi de formation, votre collègue doit travailler ce jour-là.";
    if (returnPartner !== "training" || returnMine !== "work")
      return "Une formation s’échange contre une formation : choisissez un mercredi de formation de votre collègue où vous travaillez.";
  } else {
    if (agreementMine !== "work" || agreementPartner !== "off")
      return "Pour la journée de votre cycle, vous devez travailler et votre collègue doit être en repos.";
    if (returnMine !== "off" || returnPartner !== "work")
      return "Pour la journée du cycle du collègue, vous devez être en repos et votre collègue doit travailler.";
  }
  // Un férié cédé se rend par un autre férié.
  if (getDayInfo(fromKey(draft.agreementDate), group).holiday) {
    if (!getDayInfo(fromKey(draft.returnDate), draft.partnerGroup).holiday)
      return "Un jour férié s’échange contre un autre jour férié : choisissez un férié où votre collègue travaille.";
    if (draft.returnDate.slice(0, 4) !== draft.agreementDate.slice(0, 4))
      return "Un jour férié s’échange contre un férié de la même année.";
  }

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

/** Les fériés qu'un collègue du groupe donné travaille et où vous êtes en
 *  repos, dans la même année que le férié cédé : ceux qu'il peut vous rendre. */
export function holidaysForExchangeReturn(agreementDate: string, group: number, partnerGroup: number) {
  if (!agreementDate || partnerGroup === group) return [];
  const year = fromKey(agreementDate).getFullYear();
  const start = new Date(year, 0, 1, 12);
  const holidays: Array<{ key: string; name: string }> = [];
  for (let offset = 0; offset < 366; offset++) {
    const date = addDays(start, offset);
    if (date.getFullYear() !== year) break;
    const partner = getDayInfo(date, partnerGroup);
    if (partner.holiday && partner.kind === "work" && getDayInfo(date, group).kind === "off")
      holidays.push({ key: dateKey(date), name: partner.holiday });
  }
  return holidays;
}

export function exchangeDraftFromExchange(exchange: WorkExchange, schedule?: Schedule): WorkExchangeDraft {
  return {
    id: exchange.id,
    partnerName: exchange.partnerName,
    partnerGroup: exchange.partnerGroup,
    agreementDate: exchange.agreementDate,
    returnDate: exchange.returnDate,
    // Les horaires enregistrés avec l'échange ; à défaut (échange plus ancien),
    // ceux du profil.
    agreementStart: exchange.agreementStart || scheduleHours(schedule).agreementStart,
    agreementEnd: exchange.agreementEnd || scheduleHours(schedule).agreementEnd,
    returnStart: exchange.returnStart || scheduleHours(schedule).returnStart,
    returnEnd: exchange.returnEnd || scheduleHours(schedule).returnEnd,
    replacement: !exchange.returnDate,
  };
}

/** Les champs d'échange des deux journées, pour le planning. */
export function exchangeEntryFields(
  draft: Pick<WorkExchangeDraft, "id" | "partnerName" | "partnerGroup" | "agreementDate" | "returnDate">
    & Partial<Pick<WorkExchangeDraft, "agreementStart" | "agreementEnd" | "returnStart" | "returnEnd">>,
) {
  const common = { exchangeId: draft.id, exchangePartner: draft.partnerName.trim(), exchangePartnerGroup: draft.partnerGroup };
  const given = { exchangeStart: draft.agreementStart || undefined, exchangeEnd: draft.agreementEnd || undefined };
  // Remplacement seul : la journée cédée, sans journée rendue.
  if (!draft.returnDate)
    return { [draft.agreementDate]: { ...common, ...given, exchangeRole: "given" as const, exchangeOtherDate: undefined } };
  return {
    [draft.agreementDate]: { ...common, ...given, exchangeRole: "given" as const, exchangeOtherDate: draft.returnDate },
    [draft.returnDate]: {
      ...common,
      exchangeStart: draft.returnStart || undefined,
      exchangeEnd: draft.returnEnd || undefined,
      exchangeRole: "return" as const,
      exchangeOtherDate: draft.agreementDate,
    },
  };
}
