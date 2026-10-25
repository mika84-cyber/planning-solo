import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { proposalChanges } from "./grandPalaisProposalChanges";
import { useConfirm } from "./confirmDialog";
import { useHelpTarget } from "./helpTargets";
import { scrollWhenReady } from "./scrollWhenReady";
import "./grandPalaisProgram.css";
import { clearBoundaryReport, getSharedGrandPalaisProgram, reviewGrandPalaisProposal } from "./grandPalaisProgramApi";
import { GrandPalaisCheckPanel } from "./GrandPalaisCheckPanel";
import { matchesSearch } from "./searchMatching";
import { GRAND_PALAIS_PROGRAM, grandPalaisTitleKey } from "./grandPalaisProgramData";
import type {
  GrandPalaisProgramData,
  GrandPalaisProgramEntry,
  GrandPalaisProgramYear,
  GrandPalaisVenue,
  GrandPalaisVenueKey,
} from "./grandPalaisProgramData";
import type {
  BoundaryReport,
  GrandPalaisPrice,
  GrandPalaisSitePrices,
  GrandPalaisProgramPayload,
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "./grandPalaisProgramTypes";

export type {
  GrandPalaisProgramYear,
  GrandPalaisVenueKey,
  GrandPalaisProgramEntry,
  GrandPalaisVenue,
  GrandPalaisProgramData,
} from "./grandPalaisProgramData";
export { GRAND_PALAIS_PROGRAM } from "./grandPalaisProgramData";

type GrandPalaisVenuePalette = { background: string; accent: string; line: string };

const GRAND_PALAIS_VENUE_PALETTES: Record<string, GrandPalaisVenuePalette> = {
  galleries34: { background: "#dcecff", accent: "#326fa8", line: "#8eb3d6" },
  gallery8: { background: "#e9ddf7", accent: "#73539d", line: "#b49bce" },
  gallery7: { background: "#f8dfe4", accent: "#a85261", line: "#d4a3ac" },
  childrenPalace: { background: "#f8edc9", accent: "#8f6a1b", line: "#d5bd71" },
  nef: { background: "#d9eee3", accent: "#35745a", line: "#8fbda9" },
  gallery910: { background: "#f5dfd0", accent: "#a45c32", line: "#d5a486" },
  "other:salon-seine": { background: "#d8eef2", accent: "#28798a", line: "#86bac4" },
  "other:salon-honneur": { background: "#f3dce9", accent: "#9a4d79", line: "#cea2ba" },
  "other:grand-palais": { background: "#e1e8ee", accent: "#526f88", line: "#aabac7" },
  "other:rotonde-salon-seine-palais-enfants": { background: "#dcebd5", accent: "#4d7a3d", line: "#a3c394" },
  "other:galeries-2-2": { background: "#f4dfc8", accent: "#9b6428", line: "#d2ae80" },
  "other:rotonde-d-antin": { background: "#e3e0f4", accent: "#655695", line: "#aaa1cc" },
};

const DYNAMIC_VENUE_PALETTES: GrandPalaisVenuePalette[] = [
  { background: "#d9edf5", accent: "#397d98", line: "#91bdcf" },
  { background: "#f4ddd5", accent: "#a4563f", line: "#d3a18f" },
  { background: "#e4e0f3", accent: "#675995", line: "#aba2cb" },
  { background: "#e3edd2", accent: "#607d35", line: "#acc28a" },
  { background: "#f3e5c8", accent: "#8c6720", line: "#d2b675" },
  { background: "#eeddea", accent: "#8e527b", line: "#c5a2bb" },
];

export function grandPalaisVenuePalette(venueKey: string): GrandPalaisVenuePalette {
  const known = GRAND_PALAIS_VENUE_PALETTES[venueKey];
  if (known) return known;
  const hash = [...venueKey].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return DYNAMIC_VENUE_PALETTES[hash % DYNAMIC_VENUE_PALETTES.length];
}

function venueCountLabel(count: number) {
  return count ? `${count} exposition${count > 1 ? "s" : ""} au programme` : "rien d’annoncé pour l’instant";
}

function grandPalaisVenueStyle(venueKey: string): CSSProperties {
  const palette = grandPalaisVenuePalette(venueKey);
  return { "--venue-bg": palette.background, "--venue-accent": palette.accent, "--venue-line": palette.line } as CSSProperties;
}

export function safeGrandPalaisUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === "https://www.grandpalais.fr"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

/** Le site tiers vers lequel la fiche officielle renvoie pour les tarifs ou
 *  la billetterie : une adresse sûre, nommée, hors du site officiel (qui a
 *  déjà son lien). Tout le reste est tu. */
export function safeTicketingUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    // Un nom de domaine, pas une adresse IP ni un hôte local, sans identifiants.
    return url.protocol === "https:" && !url.username && /^[\w-]+(?:\.[a-z][\w-]*)+$/i.test(url.hostname)
      && !/(?:^|\.)grandpalais\.fr$/i.test(url.hostname)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

/** « legrandpalaisdeglace.fr » : le nom d'un site tiers déjà vérifié. */
export function ticketingHost(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** Deux écritures du même événement : même fiche officielle, même titre, ou
 *  des titres qui se contiennent (« Paris Photo 2026 » dans « Paris Photo
 *  World Supreme ») à des dates qui se chevauchent. Sans cela, une mise à
 *  jour acceptée sous un titre un peu différent s'ajoutait à l'entrée livrée
 *  au lieu de la remplacer : deux cartes pour la même patinoire. */
function isSameGrandPalaisEvent(
  entry: GrandPalaisProgramEntry,
  shared: { title: string; officialUrl: string; startDate: string; endDate: string },
) {
  if (entry.officialUrl === shared.officialUrl || entry.title.toLowerCase() === shared.title.toLowerCase()) return true;
  const known = grandPalaisTitleKey(entry.title);
  const candidate = grandPalaisTitleKey(shared.title);
  return Boolean(known && candidate && (known.includes(candidate) || candidate.includes(known)))
    && (!entry.startsOn || !entry.endsOn || (shared.startDate <= entry.endsOn && entry.startsOn <= shared.endDate));
}


function remotePeriod(event: SharedGrandPalaisEvent) {
  if (event.startDate === event.endDate) return `Date officielle : ${formatFrenchDate(event.startDate)}`;
  return `Du ${formatFrenchDate(event.startDate)} au ${formatFrenchDate(event.endDate)}`;
}

export function mergeSharedGrandPalaisProgram(
  base: GrandPalaisProgramData,
  sharedEvents: SharedGrandPalaisEvent[],
): GrandPalaisProgramData {
  const merged = Object.fromEntries(Object.entries(base).map(([key, venue]) => [
    key,
    {
      ...venue,
      schedule: Object.fromEntries(Object.entries(venue.schedule).map(([year, entries]) => [
        year,
        [...(entries ?? [])],
      ])),
    },
  ])) as GrandPalaisProgramData;

  for (const shared of sharedEvents) {
    if (shared.venueKey === "exceptional-closure") continue;
    const officialUrl = safeGrandPalaisUrl(shared.url);
    if (!officialUrl) continue;
    const identity = { title: shared.title, officialUrl, startDate: shared.startDate, endDate: shared.endDate };
    // L'entrée livrée que cette mise à jour remplace : ses tarifs, si la
    // fiche a été relue avant de les publier, son audioguide, son site de
    // billetterie et sa condition de tarif, que le site ne dit pas, restent.
    const replaced = Object.values(merged)
      .flatMap((venue) => Object.values(venue.schedule).flatMap((entries) => entries ?? []))
      .filter((entry) => isSameGrandPalaisEvent(entry, identity));
    const knownPrices = replaced.find((entry) => entry.prices?.length)?.prices;
    const known = <K extends keyof GrandPalaisProgramEntry>(field: K) => replaced.find((entry) => entry[field])?.[field];
    for (const venue of Object.values(merged))
      for (const year of Object.keys(venue.schedule))
        venue.schedule[Number(year)] = (venue.schedule[Number(year)] ?? []).filter((entry) => !isSameGrandPalaisEvent(entry, identity));
    if (shared.deleted) continue;

    const key = shared.venueKey;
    if (!merged[key]) merged[key] = {
      label: shared.venueLabel,
      heading: shared.venueLabel,
      schedule: {},
    };
    const ticketingUrl = safeTicketingUrl(shared.ticketingUrl) || known("ticketingUrl");
    const audioguide = known("audioguide");
    const priceNote = known("priceNote");
    const priceGroupHours = known("priceGroupHours");
    const entry: GrandPalaisProgramEntry = {
      title: shared.title,
      ...(shared.details ? { details: shared.details } : {}),
      period: remotePeriod(shared),
      officialUrl,
      startsOn: shared.startDate,
      endsOn: shared.endDate,
      ...(shared.prices?.length ? { prices: shared.prices } : knownPrices ? { prices: knownPrices } : {}),
      ...(ticketingUrl ? { ticketingUrl } : {}),
      ...(audioguide ? { audioguide } : {}),
      ...(priceNote ? { priceNote } : {}),
      ...(priceGroupHours ? { priceGroupHours } : {}),
    };
    const firstYear = Number(shared.startDate.slice(0, 4));
    const lastYear = Number(shared.endDate.slice(0, 4));
    for (let year = firstYear; year <= lastYear; year++) {
      const schedule = merged[key].schedule[year] ?? [];
      merged[key].schedule[year] = [...schedule, entry]
        .sort((left, right) => (left.startsOn ?? "9999").localeCompare(right.startsOn ?? "9999"));
    }
  }
  return merged;
}

/** Un titre réduit à ce qui le distingue, voir `grandPalaisTitleKey`. */
const titleWords = grandPalaisTitleKey;

/** Les tarifs relevés sur le site à chaque passage de la veille, appliqués
 *  aux événements du programme qui n'ont pas été validés depuis la veille :
 *  « Paris Photo World Supreme » reprend ceux de la fiche « Paris Photo
 *  2026 ». Une fiche correspond si l'un des titres contient l'autre et si
 *  leurs dates se chevauchent, ou, à défaut, si elle est la seule à avoir
 *  exactement les mêmes dates ; elle remplace les tarifs connus. */
export function applyGrandPalaisSitePrices(
  program: GrandPalaisProgramData,
  sitePrices: GrandPalaisSitePrices[],
): GrandPalaisProgramData {
  if (!sitePrices.length) return program;
  const sites = sitePrices
    .map((site) => ({ ...site, words: titleWords(site.title), url: safeGrandPalaisUrl(site.url) }))
    // Un titre trop court (« Fête ») correspondrait à n'importe quoi.
    .filter((site) => site.words.length >= 6 && site.prices.length);
  const matching = (entry: GrandPalaisProgramEntry) => {
    if (!entry.startsOn || !entry.endsOn) return undefined;
    const words = titleWords(entry.title);
    const byTitle = sites.find((site) =>
      (site.url && entry.officialUrl === site.url) ||
      (words && (words.includes(site.words) || site.words.includes(words)) &&
        site.startDate <= entry.endsOn! && entry.startsOn! <= site.endDate));
    if (byTitle) return byTitle;
    /* Titres différents (« Arabian Horse Championship » dans l'application,
       « Championnat du Monde du Cheval Arabe » sur le site) : une fiche aux
       mêmes dates exactes, seule à les avoir, est la même manifestation. */
    const sameDates = sites.filter((site) => site.startDate === entry.startsOn && site.endDate === entry.endsOn);
    return sameDates.length === 1 ? sameDates[0] : undefined;
  };
  return Object.fromEntries(Object.entries(program).map(([key, venue]) => [key, {
    ...venue,
    schedule: Object.fromEntries(Object.entries(venue.schedule).map(([year, entries]) => [year, (entries ?? []).map((entry) => {
      const site = matching(entry);
      if (!site) return entry;
      return { ...entry, prices: site.prices, ...(entry.officialUrl || !site.url ? {} : { officialUrl: site.url }) };
    })])),
  }])) as GrandPalaisProgramData;
}

const PRIMARY_VENUES = ["galleries34", "gallery8", "gallery7", "childrenPalace"] as const;
/** Les galeries d'exposition et le Palais des enfants ne montrent que les
 *  tarifs payants : la gratuité (moins de 18 ans, demandeurs d'emploi…) y est
 *  tue, même relue par la veille. Ailleurs — la Nef, les espaces ajoutés —
 *  elle se lit. */
export const PAID_ONLY_VENUES = new Set(["galleries34", "gallery8", "gallery7", "gallery910", "childrenPalace"]);
const OTHER_VENUES = ["nef", "gallery910"] as const;
const INTEREXPO_VENUES = ["galleries34", "gallery8", "gallery7"] as const;

/** « En ce moment » se lit toujours dans le même ordre : les quatre grands
 *  espaces d'abord, les autres ensuite, la Nef en dernier. */
export function currentVenueRank(venueKey: string) {
  const primary = PRIMARY_VENUES.indexOf(venueKey as (typeof PRIMARY_VENUES)[number]);
  if (primary !== -1) return primary;
  return venueKey === "nef" ? PRIMARY_VENUES.length + 100 : PRIMARY_VENUES.length;
}

type PrimaryChoice = GrandPalaisVenueKey | "other";
type ProgramView = "now" | "upcoming" | "space" | "interexpo";

export type InterExhibitionPeriod = {
  startsOn: string;
  endsOn: string;
};

/** Une date décalée de quelques mois. Un 31 reporté sur un mois plus court
 *  s'arrête à son dernier jour, comme le fait un calendrier. */
function addMonths(date: Date, months: number) {
  const shifted = new Date(date.getTime());
  const day = shifted.getUTCDate();
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(day, lastDay));
  return shifted;
}

/** Un délai dit en années, mois et jours, sans jamais énoncer une unité qui
 *  vaut zéro : « 4 jours », « 10 mois et 15 jours », « 1 an et 3 jours ». Les
 *  mois sont comptés de quantième en quantième, et non par tranches fixes. */
export function delayLabel(from: string, to: string) {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (end <= start) return "";
  let elapsedMonths = 0;
  while (addMonths(start, elapsedMonths + 1) <= end) elapsedMonths += 1;
  const days = Math.round((end.getTime() - addMonths(start, elapsedMonths).getTime()) / 86_400_000);
  const years = Math.floor(elapsedMonths / 12);
  const months = elapsedMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mois`);
  if (days > 0) parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}

/** La même durée, arrondie pour un petit écran : exacte sous un mois
 *  (« 12 jours »), sinon au mois le plus proche (« ~2 mois », « ~1 an 4 mois »).
 *  La date exacte est toujours affichée à côté. */
export function shortDelayLabel(from: string, to: string) {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (end <= start) return "";
  let elapsedMonths = 0;
  while (addMonths(start, elapsedMonths + 1) <= end) elapsedMonths += 1;
  if (!elapsedMonths) return delayLabel(from, to);
  const days = Math.round((end.getTime() - addMonths(start, elapsedMonths).getTime()) / 86_400_000);
  const rounded = elapsedMonths + (days >= 15 ? 1 : 0);
  const years = Math.floor(rounded / 12);
  const months = rounded % 12;
  const approximate = days > 0 ? "~" : "";
  if (!years) return `${approximate}${months} mois`;
  return `${approximate}${years} an${years > 1 ? "s" : ""}${months ? ` ${months} mois` : ""}`;
}

/** Une durée longue sur grand écran, arrondie sur téléphone : le CSS montre
 *  l'une ou l'autre. */
function DelayText({ long, short }: { long: string; short: string }) {
  if (!short || short === long) return <>{long}</>;
  return <><span className="delay-long">{long}</span><span className="delay-short">{short}</span></>;
}

/** « Du 31 août au 22 septembre 2026 » : l'année, puis le mois, ne sont écrits
 *  qu'une fois lorsque les deux bornes les partagent. */
export function interExhibitionRangeLabel(period: InterExhibitionPeriod) {
  const sameYear = period.startsOn.slice(0, 4) === period.endsOn.slice(0, 4);
  const sameMonth = sameYear && period.startsOn.slice(0, 7) === period.endsOn.slice(0, 7);
  const start = formatDatePart(period.startsOn, sameMonth
    ? { day: "numeric" }
    : sameYear
      ? { day: "numeric", month: "long" }
      : { day: "numeric", month: "long", year: "numeric" });
  return `Du ${start} au ${formatFrenchDate(period.endsOn)}`;
}

export function describeInterExhibitionPeriod(period: InterExhibitionPeriod, today: string) {
  const durationDays = dayDistance(period.startsOn, period.endsOn) + 1;
  if (period.startsOn <= today && today <= period.endsOn) {
    const remainingDays = dayDistance(today, period.endsOn);
    return {
      durationDays,
      status: "En cours" as const,
      timing: remainingDays === 0 ? "Dernier jour" : `Encore ${delayLabel(today, period.endsOn)}`,
      shortTiming: remainingDays === 0 ? "Dernier jour" : `Encore ${shortDelayLabel(today, period.endsOn)}`,
    };
  }
  return {
    durationDays,
    status: "À venir" as const,
    timing: dayDistance(today, period.startsOn) === 1
      ? "Demain"
      : `Dans ${delayLabel(today, period.startsOn)}`,
    shortTiming: dayDistance(today, period.startsOn) === 1
      ? "Demain"
      : `Dans ${shortDelayLabel(today, period.startsOn)}`,
  };
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatFrenchDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

function formatDatePart(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

/* Les quatre vues de la programmation, chacune avec son dessin : un tableau
   (ce qui est accroché en ce moment), un calendrier qui avance, la nef du
   Grand Palais, et deux cadres reliés (le passage d'une expo à l'autre). */
const VIEW_ICONS = {
  now: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="1.5" /><path d="m6.5 16 3.5-4.5 2.5 3 2-2 3 3.5" /><circle className="view-icon-dot" cx="17.5" cy="8.5" r="1.6" /></svg>,
  upcoming: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5v3m10-3v3M4 9h16" /><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M10 15h5m-2-2 2 2-2 2" /></svg>,
  space: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10a7 7 0 0 1 14 0" /><path d="M3.5 10h17M5.5 10v8.5m4.3-8.5v8.5m4.4-8.5v8.5m4.3-8.5v8.5M3.5 20.5h17M12 3v-.5" /></svg>,
  interexpo: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="7" height="9" rx="1" /><rect x="14.5" y="7" width="7" height="9" rx="1" /><path d="M10.5 11.5h3m-1.2-1.6 1.6 1.6-1.6 1.6" /></svg>,
} as const;

/** Intitulé d'un regroupement mensuel : « Septembre 2026 ». */
function monthHeading(value: string) {
  const label = formatDatePart(value, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isGrandPalaisEntryVisible(
  entry: GrandPalaisProgramEntry,
  today = new Date().toISOString().slice(0, 10),
) {
  return !entry.endsOn || entry.endsOn >= today;
}

export function calculateInterExhibitionPeriods(
  today = new Date().toISOString().slice(0, 10),
  program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM,
): InterExhibitionPeriod[] {
  const datedEntries = INTEREXPO_VENUES.flatMap((venueKey) =>
    Object.values(program[venueKey].schedule)
      .flatMap((entries) => entries ?? [])
      .filter((entry): entry is GrandPalaisProgramEntry & { startsOn: string; endsOn: string } => Boolean(entry.startsOn && entry.endsOn))
  )
    .filter((entry, index, entries) => entries.findIndex((candidate) =>
      candidate.startsOn === entry.startsOn && candidate.endsOn === entry.endsOn && candidate.title === entry.title,
    ) === index)
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn));

  const openPeriods = datedEntries.reduce<Array<{ startsOn: string; endsOn: string }>>((periods, entry) => {
    const previous = periods.at(-1);
    if (!previous || entry.startsOn > addIsoDays(previous.endsOn, 1)) {
      periods.push({ startsOn: entry.startsOn, endsOn: entry.endsOn });
    } else if (entry.endsOn > previous.endsOn) {
      previous.endsOn = entry.endsOn;
    }
    return periods;
  }, []);

  return openPeriods.slice(1).flatMap((period, index) => {
    const startsOn = addIsoDays(openPeriods[index].endsOn, 1);
    const endsOn = addIsoDays(period.startsOn, -1);
    const durationInDays = Math.round(
      (new Date(`${endsOn}T12:00:00Z`).getTime() - new Date(`${startsOn}T12:00:00Z`).getTime()) / 86_400_000,
    ) + 1;
    if (durationInDays < 3 || endsOn < today) return [];
    return [{ startsOn, endsOn }];
  });
}

export type InterExhibitionLeadIn = Array<{ venueKey: string; venueLabel: string; title: string; startsOn: string; endsOn: string }>;

/** Les expositions des trois galeries avant chaque coupure : d'aujourd'hui à
 *  la veille de la première, puis entre la fin d'une coupure et le début de
 *  la suivante. Tiré du programme complet, il suit tout seul les expositions
 *  ajoutées. */
export function exhibitionsBeforeInterExhibitions(
  periods: InterExhibitionPeriod[],
  today: string,
  program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM,
): InterExhibitionLeadIn[] {
  return periods.map((period, index) =>
    exhibitionsBetween(index === 0 ? today : addIsoDays(periods[index - 1].endsOn, 1), addIsoDays(period.startsOn, -1), program));
}

/** La programmation connue après la dernière coupure : pas encore de
 *  coupure calculable derrière elle, elle s'y ajoutera d'elle-même quand
 *  les expositions suivantes seront annoncées dans les trois galeries. */
export function exhibitionsAfterInterExhibitions(
  periods: InterExhibitionPeriod[],
  program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM,
) {
  return periods.length ? exhibitionsBetween(addIsoDays(periods[periods.length - 1].endsOn, 1), "9999-12-31", program) : [];
}

function exhibitionsBetween(from: string, to: string, program: GrandPalaisProgramData): InterExhibitionLeadIn {
    if (to < from) return [];
    const seen = new Set<string>();
    return INTEREXPO_VENUES.flatMap((venueKey) =>
      Object.values(program[venueKey].schedule)
        .flatMap((entries) => entries ?? [])
        .filter((entry) => entry.startsOn && entry.endsOn && entry.startsOn <= to && entry.endsOn >= from)
        .map((entry) => ({ venueKey, venueLabel: program[venueKey].label, title: entry.title, startsOn: entry.startsOn!, endsOn: entry.endsOn! })),
    )
      .filter((item) => {
        const key = `${item.venueKey}|${item.title}|${item.startsOn}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => left.startsOn.localeCompare(right.startsOn));
}

/** « 1er août 2027 » : l'année n'est écrite que lorsqu'elle n'est pas celle
 *  d'aujourd'hui. */
function leadInDay(value: string, today: string, withYear = false) {
  return formatDatePart(value, !withYear && value.slice(0, 4) === today.slice(0, 4)
    ? { day: "numeric", month: "long" }
    : { day: "numeric", month: "long", year: "numeric" }).replace(/^1 /, "1er ");
}

/** « du 23 septembre 2026 au 17 janvier 2027 » : les deux dates, toujours,
 *  avec l'année de départ dès qu'elle diffère de celle de fin. */
function leadInDates(item: { startsOn: string; endsOn: string }, today: string) {
  const acrossYears = item.startsOn.slice(0, 4) !== item.endsOn.slice(0, 4);
  return `du ${leadInDay(item.startsOn, today, acrossYears)} au ${leadInDay(item.endsOn, today)}`;
}

/** Les expositions d'un espace, année par année. Une exposition à cheval sur
 *  deux années (même titre, mêmes dates) n'y figure qu'une fois : dans
 *  l'année où elle commence, avec sa période complète. Un événement qui
 *  revient chaque année sous le même titre (Art Basel) reste dans chacune. */
export function venueYearGroups(
  venue: GrandPalaisVenue,
  years: readonly GrandPalaisProgramYear[],
  today: string,
) {
  const shown = new Set<string>();
  return years
    .map((year) => ({
      year,
      entries: (venue.schedule[year] ?? []).filter((entry) => {
        if (!isGrandPalaisEntryVisible(entry, today)) return false;
        const key = `${grandPalaisTitleKey(entry.title)}|${entry.startsOn ?? entry.period}|${entry.endsOn ?? ""}`;
        if (shown.has(key)) return false;
        shown.add(key);
        return true;
      }),
    }))
    .filter((group) => group.entries.length);
}

function venueYears(
  venueKey: string,
  today = new Date().toISOString().slice(0, 10),
  program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM,
) {
  return Object.keys(program[venueKey]?.schedule ?? {})
    .map(Number)
    .filter((year) => (program[venueKey].schedule[year] ?? [])
      .some((entry) => isGrandPalaisEntryVisible(entry, today)))
    .sort((left, right) => left - right) as GrandPalaisProgramYear[];
}

/** Les espaces de « Autres » qui ont encore une exposition au programme. Un
 *  espace vide en disparaît, et y revient seul dès qu'une exposition détectée
 *  sur le site du Grand Palais y est acceptée par l'administrateur. */
export function otherGrandPalaisVenueKeys(program: GrandPalaisProgramData, today: string) {
  return [
    ...OTHER_VENUES,
    ...Object.keys(program)
      .filter((key) => key.startsWith("other:") && !OTHER_VENUES.includes(key as never))
      .sort((first, second) => program[first].label.length - program[second].label.length),
  ].filter((key) => venueYears(key, today, program).length > 0);
}

export function grandPalaisClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return { today: `${part("year")}-${part("month")}-${part("day")}`, openingReady: Number(part("hour")) * 60 + Number(part("minute")) >= 5 };
}

export function isGrandPalaisEntryCurrent(
  entry: GrandPalaisProgramEntry,
  today = new Date().toISOString().slice(0, 10),
  openingReady = true,
) {
  if (entry.startsOn === today && !openingReady) return false;
  return entry.currentlyOpen === true
    || Boolean(entry.startsOn && entry.endsOn && entry.startsOn <= today && today <= entry.endsOn);
}

function dayDistance(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

export function grandPalaisEntryStatus(
  entry: GrandPalaisProgramEntry,
  today = new Date().toISOString().slice(0, 10),
  openingReady = true,
) {
  if (!entry.startsOn && entry.currentlyOpen !== true) return { label: "À confirmer", detail: "" };
  // À confirmer, mais avec des dates : on dit déjà dans combien de temps.
  if (entry.uncertain) {
    if (!entry.startsOn || entry.startsOn <= today) return { label: "À confirmer", detail: "" };
    return {
      label: "À confirmer",
      detail: dayDistance(today, entry.startsOn) === 1 ? "Commence demain" : `Commence dans ${delayLabel(today, entry.startsOn)}`,
    };
  }
  if (isGrandPalaisEntryCurrent(entry, today, openingReady)) {
    const remaining = entry.endsOn ? Math.max(0, dayDistance(today, entry.endsOn)) : null;
    return {
      label: "En cours",
      detail: remaining === null ? "" : remaining === 0 ? "Dernier jour"
        : `Encore ${delayLabel(today, entry.endsOn!)}`,
    };
  }
  if (entry.startsOn === today && !openingReady) return { label: "Prochainement", detail: "Commence aujourd’hui à 00 h 05" };
  if (entry.startsOn && entry.startsOn > today) {
    return {
      label: "Prochainement",
      detail: dayDistance(today, entry.startsOn) === 1
        ? "Commence demain"
        : `Commence dans ${delayLabel(today, entry.startsOn)}`,
    };
  }
  return { label: "À confirmer", detail: "" };
}

/** « 22 octobre » : le jour d'un tarif qui ne vaut que pour une date. */
function dayAndMonth(key: string) {
  return formatDatePart(key, { day: "numeric", month: "long" });
}

/** « 19 € » : les tarifs du Grand Palais tombent juste, sans centimes. */
export function priceLabel(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

/** Les tarifs rangés par grille, dans l'ordre de la fiche : les grilles
 *  nommées (« Session du matin ») puis, sans nom, ceux qui valent pour
 *  toutes — une gratuité, un billet unique. */
export function groupGrandPalaisPrices(prices: GrandPalaisPrice[]) {
  const groups: Array<{ name: string; prices: GrandPalaisPrice[] }> = [];
  for (const price of prices) {
    const name = price.group ?? "";
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.prices.push(price);
    else groups.push({ name, prices: [price] });
  }
  return groups;
}

/** Les tarifs d'une proposition sur une ligne : « À partir de 45 € »,
 *  « Plein 19 € · Réduit 16 € », « Gratuit », et par grille
 *  « Session du matin : Adultes 27 €, Enfants 15 € · Nocturne : … ». */
export function proposalPricesLabel(prices: GrandPalaisPrice[]) {
  const one = (price: GrandPalaisPrice) => price.amount === 0
    ? (/^(?:gratuit|accès)$/i.test(price.label) ? "Gratuit" : `${price.label} gratuit`)
    : `${price.label} ${priceLabel(price.amount)}`;
  return groupGrandPalaisPrices(prices)
    .map((group) => group.name ? `${group.name} : ${group.prices.map(one).join(", ")}` : group.prices.map(one).join(" · "))
    .join(" · ");
}

/** Une exposition : la salle, le titre, la période et le temps restant. Une
 *  exposition ouverte montre en plus où elle en est. */
export function ExpoCard({ entry, venueKey, venueLabel, today, openingReady, linkLabel }: {
  entry: GrandPalaisProgramEntry;
  venueKey: string;
  venueLabel?: string;
  today: string;
  openingReady: boolean;
  linkLabel: string;
}) {
  const status = grandPalaisEntryStatus(entry, today, openingReady);
  // Le compte à rebours d'une exposition à venir, même encore à confirmer.
  const countdown = status.detail.startsWith("Commence ") ? status.detail.replace(/^Commence /, "") : "";
  const upcomingCountdown = countdown ? countdown.charAt(0).toUpperCase() + countdown.slice(1) : "";
  // Un tarif qui ne valait que pour un jour passé n'a plus à être montré.
  const visiblePrices = (entry.prices ?? []).filter((price) =>
    (!price.until || price.until >= today) && !(price.amount === 0 && PAID_ONLY_VENUES.has(venueKey)));
  const priceGroups = groupGrandPalaisPrices(visiblePrices);
  const officialUrl = safeGrandPalaisUrl(entry.officialUrl);
  // Le site tiers qui porte la billetterie — et les tarifs eux-mêmes quand
  // la fiche officielle n'en annonce aucun.
  const ticketingUrl = safeTicketingUrl(entry.ticketingUrl);
  const ticketingLabel = ticketingUrl
    ? `${visiblePrices.length ? "Billetterie sur" : "Voir les tarifs sur"} ${ticketingHost(ticketingUrl)}`
    : "";
  const [audioguideQrOpen, setAudioguideQrOpen] = useState(false);
  return (
    <article
      className="expo-card"
      data-venue={venueKey}
      data-status={status.label}
      style={grandPalaisVenueStyle(venueKey)}
    >
      <span className="useful-expo-timeline-mark" aria-hidden="true" />
      <div>
        {/* En tête de carte : la salle à gauche, l'état à droite. Une
            exposition à venir montre plutôt son compte à rebours exact, sous
            ses dates : trop long pour tenir en haut à côté de la salle. */}
        <div className="expo-card-top">
          {venueLabel ? <span className="useful-expo-venue">{venueLabel}</span> : null}
          {upcomingCountdown && status.label !== "À confirmer" ? null : (
            <span className="expo-card-status">
              <em>{status.label}</em>
            </span>
          )}
        </div>
        <strong>{entry.title}</strong>
        {entry.details ? <p>{entry.details}</p> : null}
        <small>{entry.period}</small>
        {upcomingCountdown ? (
          <span className="expo-card-status expo-card-countdown">
            <em>{upcomingCountdown}</em>
          </span>
        ) : null}
        {status.detail && !upcomingCountdown ? <span className="expo-card-remaining">{status.detail}</span> : null}
        {/* L'audioguide de l'exposition : son QR code reste visible pour
            le visiteur (un toucher l'agrandit), le code d'accès se lit à côté
            et « Ouvrir l'audioguide » le copie avant d'ouvrir la page. */}
        {entry.audioguide ? (
          <div className="expo-audioguide">
            <div className="expo-audioguide-card">
              <button type="button" className="expo-audioguide-qr" aria-expanded={audioguideQrOpen} aria-label={audioguideQrOpen ? "Masquer le QR code" : "Afficher le QR code"} onClick={() => setAudioguideQrOpen((open) => !open)}>
                <img src={entry.audioguide.qr} alt="" width="84" height="84" />
                <span className="expo-audioguide-zoom" aria-hidden="true">
                  <svg viewBox="0 0 24 24">{audioguideQrOpen ? <path d="M5 12h14" /> : <path d="M12 5v14M5 12h14" />}</svg>
                </span>
              </button>
              <span className="expo-audioguide-body">
                <strong>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><path d="M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zm16 0a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z" /></svg>
                  Audioguide
                </strong>
                <small>{entry.audioguide.languages}</small>
                <span className="expo-audioguide-code">Code d’accès <b>{entry.audioguide.code}</b></span>
                <a href={entry.audioguide.url} target="_blank" rel="noopener noreferrer" onClick={() => void navigator.clipboard?.writeText(entry.audioguide!.code).catch(() => undefined)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
                  Ouvrir l’audioguide
                </a>
              </span>
            </div>
            {audioguideQrOpen ? (
              <figure>
                <img src={entry.audioguide.qr} alt={`QR code de l’audioguide ${entry.title}`} width="200" height="200" />
                <figcaption>À flasher par le visiteur</figcaption>
              </figure>
            ) : null}
          </div>
        ) : null}
        {/* Les tarifs ferment la carte, juste avant le lien : on lit d'abord
            ce qu'est l'exposition, puis ce qu'elle coûte. */}
        {visiblePrices.length || entry.priceNote ? (
          <div className="expo-price">
            <p>Tarifs</p>
            {/* Chaque grille de la fiche sous son nom — session du matin,
                de l'après-midi, nocturne —, ses horaires à côté, puis ce qui
                vaut pour toutes. */}
            {priceGroups.map((group) => (
              <Fragment key={group.name}>
                {group.name ? (
                  <span className="expo-price-group">
                    {group.name}
                    {entry.priceGroupHours?.[group.name] ? <>{" "}<span className="expo-price-hours">{entry.priceGroupHours[group.name]}</span></> : null}
                  </span>
                ) : null}
                <dl>
                  {group.prices.map((price) => (
                    <Fragment key={price.label}>
                      <dt>
                        {/* « Gratuit : Gratuit » se lit « Accès : Gratuit ». */}
                        {price.amount === 0 && /^gratuit$/i.test(price.label) ? "Accès" : price.label}
                        {price.until ? <span> le {dayAndMonth(price.until)}</span> : null}
                      </dt>
                      <dd>{price.amount === 0 ? "Gratuit" : priceLabel(price.amount)}</dd>
                    </Fragment>
                  ))}
                </dl>
              </Fragment>
            ))}
            {entry.priceNote ? <span className="expo-price-note">{entry.priceNote}</span> : null}
          </div>
        ) : null}
        {officialUrl || ticketingUrl ? (
          <span className="expo-card-links">
            {officialUrl ? <a href={officialUrl} target="_blank" rel="noreferrer">{linkLabel}</a> : null}
            {ticketingUrl ? <a href={ticketingUrl} target="_blank" rel="noopener noreferrer">{ticketingLabel}</a> : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Ce que le contrôle hebdomadaire des frontières a constaté. Affiché à la
 *  seul administrateur : un contrôle ne peut pas rendre compte par le
 *  canal qu'il teste, il lui faut donc un endroit dans l'application. */
export function BoundaryReportPanel({
  report,
  onClear,
  clearing = false,
  error = "",
}: {
  report: BoundaryReport;
  onClear?: () => void;
  clearing?: boolean;
  error?: string;
}) {
  const failingBoundaries = report.boundaries.filter((boundary) => !boundary.ok);
  return (
    <section className="grand-palais-admin-alerts" aria-labelledby="grand-palais-health-title">
      <div>
        <span className="step-label">Réservé à votre compte</span>
        <h3 id="grand-palais-health-title">Contrôle des alertes</h3>
        <p>
          {failingBoundaries.length
            ? "Une alerte pourrait ne pas vous parvenir."
            : "Tout ce qui doit vous prévenir répond."}{" "}
          Vérifié le {formatFrenchDate(report.checkedAt.slice(0, 10))}.
        </p>
        {onClear ? (
          <button type="button" className="grand-palais-health-clear" disabled={clearing} onClick={onClear}>
            {clearing ? "Effacement…" : "Effacer ces données"}
          </button>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <div className="grand-palais-admin-alert-list">
        {report.boundaries.map((boundary) => (
          <article key={boundary.name}>
            <small>{boundary.ok ? "Répond" : "Ne répond pas"}</small>
            <strong>{boundary.name}</strong>
            <span>{boundary.detail}</span>
          </article>
        ))}
        {report.deliveryDetail ? (
          <article>
            <small>Envoi réel, une fois par mois</small>
            <strong>Preuve de livraison</strong>
            <span>
              {report.deliveryDetail}
              {report.lastDeliveryAt
                ? ` — le ${formatFrenchDate(report.lastDeliveryAt.slice(0, 10))}`
                : ""}
            </span>
          </article>
        ) : null}
      </div>
    </section>
  );
}

/* La veille de l'administrateur s'affiche sans attendre le serveur : la date
   et le compte rendu du dernier contrôle sont gardés sur l'appareil, puis
   remplacés dès que la programmation est relue. */
const CHECK_CACHE_KEY = "planning:gp-check-cache-v1";
type CheckCache = Pick<GrandPalaisProgramPayload, "lastCheckedAt" | "lastCheckReport">;
function readCheckCache(): CheckCache | null {
  try { return JSON.parse(localStorage.getItem(CHECK_CACHE_KEY) || "null"); } catch { return null; }
}

export function GrandPalaisProgramSection({ guestPreview = false, isAdmin = false }: { guestPreview?: boolean; isAdmin?: boolean }) {
  const [clock, setClock] = useState(() => grandPalaisClock());
  const { today, openingReady } = clock;
  useEffect(() => {
    const refresh = () => setClock(previous => {
      const next = grandPalaisClock();
      return previous.today === next.today && previous.openingReady === next.openingReady ? previous : next;
    });
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { refresh(); timer = setTimeout(tick, 60_000 - Date.now() % 60_000); };
    tick();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const [sharedPayload, setSharedPayload] = useState<GrandPalaisProgramPayload | null>(null);
  const [checkCache] = useState(readCheckCache);
  useEffect(() => {
    if (!sharedPayload?.isAdmin) return;
    try {
      localStorage.setItem(CHECK_CACHE_KEY, JSON.stringify({ lastCheckedAt: sharedPayload.lastCheckedAt, lastCheckReport: sharedPayload.lastCheckReport }));
    } catch {}
  }, [sharedPayload]);
  const [reviewBusy, setReviewBusy] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [programView, setProgramView] = useState<ProgramView>("now");
  // La fenêtre d'aide ouvre directement l'onglet voulu et y descend : les
  // dates d'une exposition au choix des espaces, les inter-expos au détail
  // des expositions et des périodes.
  useHelpTarget((target) => {
    if (target !== "program-space" && target !== "program-interexpo") return false;
    const view = target === "program-space" ? "space" : "interexpo";
    setProgramView(view);
    scrollWhenReady(`grand-palais-${view === "space" ? "spaces" : "interexpo"}`);
    return true;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const program = useMemo(
    () => applyGrandPalaisSitePrices(
      mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, sharedPayload?.approved ?? []),
      sharedPayload?.sitePrices ?? [],
    ),
    [sharedPayload?.approved, sharedPayload?.sitePrices],
  );
  const [primaryChoice, setPrimaryChoice] = useState<PrimaryChoice>("galleries34");
  const [otherVenue, setOtherVenue] = useState<string>("nef");
  const otherVenueKeys = useMemo(() => otherGrandPalaisVenueKeys(program, today), [program, today]);
  const activeOtherVenue = otherVenueKeys.includes(otherVenue) ? otherVenue : otherVenueKeys[0] ?? "nef";
  const selectedVenueKey = primaryChoice === "other" ? activeOtherVenue : primaryChoice;
  const venue = program[selectedVenueKey] ?? program.nef;
  const years = useMemo(() => venueYears(selectedVenueKey, today, program), [selectedVenueKey, today, program]);
  const normalizedSearch = searchQuery.trim();
  // Une recherche a son propre panneau : chaque onglet montre tout son contenu.
  // Un espace se lit année par année : chaque année en liste, ses expositions
  // dessous, une exposition à cheval sur deux années une seule fois.
  const yearGroups = venueYearGroups(venue, years, today);
  const venueTotal = new Set(yearGroups.flatMap((group) => group.entries.map((entry) => entry.title))).size;
  // Choisir un espace mène directement à ses expositions, sans descendre soi-même.
  const venuePanelRef = useRef<HTMLElement | null>(null);
  const [venueScrollRequest, setVenueScrollRequest] = useState(0);
  useEffect(() => {
    if (!venueScrollRequest) return;
    venuePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [venueScrollRequest]);
  const interExhibitionPeriods = useMemo(() => calculateInterExhibitionPeriods(today, program), [today, program]);
  const interExhibitionLeadIns = useMemo(
    () => exhibitionsBeforeInterExhibitions(interExhibitionPeriods, today, program),
    [interExhibitionPeriods, today, program],
  );
  const interExhibitionTail = useMemo(
    () => exhibitionsAfterInterExhibitions(interExhibitionPeriods, program),
    [interExhibitionPeriods, program],
  );
  const allEntries = useMemo(() => {
    const seen = new Set<string>();
    return Object.entries(program).flatMap(([venueKey, item]) => Object.values(item.schedule).flatMap((scheduled) => scheduled ?? []).map((entry) => ({
      entry,
      venueKey,
      venueLabel: item.label,
    }))).filter(({ entry, venueKey }) => {
      const key = `${venueKey}:${entry.title}:${entry.endsOn || entry.period}`;
      if (seen.has(key) || !isGrandPalaisEntryVisible(entry, today)) return false;
      seen.add(key);
      return true;
    });
  }, [program, today]);
  const currentEntries = allEntries
    .filter(({ entry }) => isGrandPalaisEntryCurrent(entry, today, openingReady))
    // Par espace, dans l'ordre fixe ci-dessus ; à espace égal, celle qui ferme
    // le plus tôt d'abord, c'est la dernière à voir.
    .sort((left, right) =>
      currentVenueRank(left.venueKey) - currentVenueRank(right.venueKey) ||
      (left.entry.endsOn ?? "9999").localeCompare(right.entry.endsOn ?? "9999"));
  // Une galerie n'apparaît qu'une fois dans l'en-tête, même si elle accueille
  // plusieurs expositions.
  const openVenues = currentEntries.filter((item, index) =>
    currentEntries.findIndex((other) => other.venueKey === item.venueKey) === index);
  const upcomingEntries = allEntries
    .filter(({ entry }) => Boolean(entry.startsOn && entry.startsOn >= today && !isGrandPalaisEntryCurrent(entry, today, openingReady)))
    .sort((left, right) => (left.entry.startsOn ?? "9999").localeCompare(right.entry.startsOn ?? "9999"));
  const overviewEntries = (programView === "now" ? currentEntries : upcomingEntries)
    .map((item) => ({
      ...item,
      // « À venir » se lit mois par mois, « En ce moment » par échéance.
      heading: programView === "upcoming" && item.entry.startsOn
        ? monthHeading(item.entry.startsOn)
        : "",
    }));
  // Une recherche cherche partout : tous les espaces, toutes les années, quel
  // que soit l'onglet ouvert. Les expositions terminées en restent exclues,
  // comme dans le reste de l'écran.
  const searchResults = normalizedSearch
    ? allEntries
        .filter(({ entry }) => matchesSearch(entry.title, normalizedSearch))
        .sort((left, right) =>
          (left.entry.startsOn ?? "9999").localeCompare(right.entry.startsOn ?? "9999") ||
          currentVenueRank(left.venueKey) - currentVenueRank(right.venueKey))
    : null;
  const venueEntryCount = (venueKey: string) => new Set(Object.values(program[venueKey]?.schedule ?? {})
    .flatMap((scheduled) => scheduled ?? [])
    .filter((entry) => isGrandPalaisEntryVisible(entry, today))
    .map((entry) => entry.title)).size;
  const otherEntryCount = otherVenueKeys.reduce((total, venueKey) => total + venueEntryCount(venueKey), 0);

  useEffect(() => {
    let active = true;
    void getSharedGrandPalaisProgram()
      .then((payload) => active && setSharedPayload(payload))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const reviewProposal = async (
    proposal: GrandPalaisProgramProposal,
    decision: "accept" | "ignore",
  ) => {
    setReviewBusy(proposal.id);
    setReviewError("");
    try {
      setSharedPayload(await reviewGrandPalaisProposal(proposal.id, decision));
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "La décision n’a pas pu être enregistrée.");
    } finally {
      setReviewBusy("");
    }
  };

  const confirmAction = useConfirm();
  const clearHealth = async () => {
    if (!(await confirmAction({ title: "Effacer le contrôle des alertes ?", message: "Il sera refait lundi à minuit.", confirmLabel: "Effacer", tone: "danger" }))) return;
    setHealthBusy(true);
    setHealthError("");
    try {
      setSharedPayload(await clearBoundaryReport());
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Le contrôle n’a pas pu être effacé.");
    } finally {
      setHealthBusy(false);
    }
  };

  const selectVenue = (venueKey: PrimaryChoice) => {
    setPrimaryChoice(venueKey);
    // « Autres » ouvre d'abord le choix de l'espace : on reste dessus.
    if (venueKey !== "other") setVenueScrollRequest((count) => count + 1);
  };

  const selectOtherVenue = (venueKey: string) => {
    setOtherVenue(venueKey);
    setVenueScrollRequest((count) => count + 1);
  };

  return (
    <section className="grand-palais-program-screen" aria-labelledby="grand-palais-program-title">
      <div className="grand-palais-program-intro">
        <div className="native-screen-heading">
          <span className="step-label">Grand Palais</span>
          <h2 id="grand-palais-program-title">Expositions et événements</h2>
          {/* Deux repères, chacun à la couleur de son espace : ce qui est
              ouvert maintenant, et ce qui ouvre ensuite. */}
          <div className="grand-palais-program-summary">
            {/* Les galeries ouvertes aujourd'hui, chacune à sa couleur ; le
                détail des expositions est juste dessous, dans « En ce moment ». */}
            <article className="grand-palais-summary-open" data-open={currentEntries.length > 0}>
              <header>
                <span className="grand-palais-summary-live">Ouvert aujourd’hui</span>
                <span className="grand-palais-summary-count">
                  {currentEntries.length ? `${currentEntries.length} exposition${currentEntries.length > 1 ? "s" : ""}` : "Aucune exposition"}
                </span>
              </header>
              {currentEntries.length ? (
                <ul className="grand-palais-summary-list">
                  {openVenues.map(({ venueKey, venueLabel }) => (
                    <li key={venueKey} style={grandPalaisVenueStyle(venueKey)}>
                      <strong>{venueLabel}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          </div>
        </div>
      </div>

      {!guestPreview && (sharedPayload ? sharedPayload.isAdmin : isAdmin) ? (
        <GrandPalaisCheckPanel
          lastCheckedAt={sharedPayload ? sharedPayload.lastCheckedAt : checkCache?.lastCheckedAt}
          report={sharedPayload ? sharedPayload.lastCheckReport : checkCache?.lastCheckReport}
          onPayload={setSharedPayload}
        />
      ) : null}

      {!guestPreview && sharedPayload?.isAdmin && sharedPayload.health ? (
        <BoundaryReportPanel
          report={sharedPayload.health}
          onClear={() => void clearHealth()}
          clearing={healthBusy}
          error={healthError}
        />
      ) : null}

      {!guestPreview && sharedPayload?.isAdmin && sharedPayload.pending.length ? (
        <section className="grand-palais-admin-alerts" aria-labelledby="grand-palais-alerts-title">
          <div>
            <span className="step-label">Réservé à votre compte</span>
            <h3 id="grand-palais-alerts-title">Mises à jour détectées</h3>
            <p>Acceptez pour les rendre visibles à tout le monde, ou ignorez-les.</p>
          </div>
          <div className="grand-palais-admin-alert-list">
            {sharedPayload.pending.map((proposal) => {
              const event = proposal.next ?? proposal.previous!;
              const kindLabel = event.venueKey === "exceptional-closure" ? "Fermeture exceptionnelle"
                : proposal.kind === "new" ? "Nouvelle exposition"
                : proposal.kind === "changed" ? "Informations modifiées" : "Exposition retirée du site";
              // Une modification dit ce qui a changé, ancien → nouveau : on
              // décide sans avoir à se souvenir de l'ancien prix.
              const changes = proposal.kind === "changed" && proposal.previous && proposal.next
                ? proposalChanges(proposal.previous, proposal.next)
                : [];
              return (
                <article key={proposal.id}>
                  <small>{kindLabel} · {event.venueLabel}</small>
                  <strong>{event.title}{event.details ? ` · ${event.details}` : ""}</strong>
                  {changes.length ? (
                    <ul className="grand-palais-proposal-changes" aria-label="Ce qui a changé">
                      {changes.map((change) => (
                        <li key={change.label}>
                          <span>{change.label}</span>
                          {change.before === null ? <b className="added">ajouté : {change.after}</b>
                            : change.after === null ? <b className="removed">retiré : <s>{change.before}</s></b>
                            : <b><s>{change.before}</s><i aria-hidden="true">→</i>{change.after}</b>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span>{remotePeriod(event)}
                      {/* Le tarif relevé se lit dès la proposition, avant l'accord. */}
                      {event.prices?.length ? ` · ${proposalPricesLabel(event.prices)}` : ""}</span>
                  )}
                  <div>
                    <button type="button" disabled={reviewBusy === proposal.id} onClick={() => void reviewProposal(proposal, "accept")}>Accepter</button>
                    <button type="button" disabled={reviewBusy === proposal.id} onClick={() => void reviewProposal(proposal, "ignore")}>Ignorer</button>
                  </div>
                </article>
              );
            })}
          </div>
          {reviewError ? <p className="grand-palais-review-error" role="alert">{reviewError}</p> : null}
        </section>
      ) : null}

      <div className="grand-palais-view-tools">
        <span className="grand-palais-view-label" aria-hidden="true">Afficher</span>
        <div className="grand-palais-view-picker" role="tablist" aria-label="Vue de la programmation">
          {([["now", "En ce moment"], ["upcoming", "À venir"], ["space", "Par espace"], ["interexpo", "Inter-expos"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={programView === value} className={programView === value ? "active" : ""} onClick={() => setProgramView(value)}>
              {VIEW_ICONS[value]}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <label className="grand-palais-search"><span>Rechercher une exposition</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Titre de l’exposition" /></label>
      </div>

      {programView === "space" && !searchResults ? <section className="grand-palais-venue-navigation" id="grand-palais-spaces" aria-labelledby="grand-palais-spaces-title">
        <div className="grand-palais-venue-navigation-heading">
          <span className="step-label">Les galeries</span>
          <h3 id="grand-palais-spaces-title">Choisir un espace</h3>
        </div>
        <div className="grand-palais-primary-picker" role="tablist" aria-label="Espace principal du Grand Palais">
        {PRIMARY_VENUES.map((venueKey) => (
          <button
            key={venueKey}
            type="button"
            role="tab"
            aria-selected={primaryChoice === venueKey}
            className={primaryChoice === venueKey ? "active" : ""}
            style={grandPalaisVenueStyle(venueKey)}
            onClick={() => selectVenue(venueKey)}
            aria-label={`${program[venueKey].label}, ${venueCountLabel(venueEntryCount(venueKey))}`}
          >
            {/* Une ligne par espace : sa couleur, son nom, le nombre d'expositions
                en grand à droite pour comparer d'un coup d'œil. */}
            <span>{program[venueKey].label}<small>{venueEntryCount(venueKey)
              ? `exposition${venueEntryCount(venueKey) > 1 ? "s" : ""} au programme`
              : "Rien d’annoncé pour l’instant"}</small></span>
            {venueEntryCount(venueKey) ? <b aria-hidden="true">{venueEntryCount(venueKey)}</b> : null}
          </button>
        ))}
        {otherVenueKeys.length ? (
          <button
            type="button"
            role="tab"
            aria-selected={primaryChoice === "other"}
            className={`grand-palais-other-choice${primaryChoice === "other" ? " active" : ""}`}
            onClick={() => selectVenue("other")}
            aria-label={`Autres, Nef et autres galeries RMN, ${venueCountLabel(otherEntryCount)}`}
          >
            <span>Autres<small>Nef et autres galeries RMN</small></span>
            {otherEntryCount ? <b aria-hidden="true">{otherEntryCount}</b> : null}
          </button>
        ) : null}
        </div>

        {primaryChoice === "other" ? (
          <div className="grand-palais-other-picker" role="tablist" aria-label="Autres espaces du Grand Palais">
            {otherVenueKeys.map((venueKey) => (
              <button
                key={venueKey}
                type="button"
                role="tab"
                aria-selected={activeOtherVenue === venueKey}
                className={activeOtherVenue === venueKey ? "active" : ""}
                style={grandPalaisVenueStyle(venueKey)}
                onClick={() => selectOtherVenue(venueKey)}
              >
                {program[venueKey].label}
              </button>
            ))}
          </div>
        ) : null}
      </section> : null}

      {searchResults ? (
        <section className="useful-expo-schedule grand-palais-program-panel" aria-live="polite">
          <div className="useful-expo-schedule-heading">
            <h3>Résultats de la recherche</h3>
            <p>
              {searchResults.length
                ? `${searchResults.length} exposition${searchResults.length > 1 ? "s" : ""} dans toute la programmation, la plus proche d'abord.`
                : "Aucune exposition de la programmation ne porte ce titre."}
            </p>
          </div>
          <div className="useful-expo-timeline">
            {searchResults.map(({ entry, venueKey, venueLabel }) => (
              <div className="expo-card-slot" key={`${venueKey}-${entry.title}-${entry.period}`}>
                <ExpoCard entry={entry} venueKey={venueKey} venueLabel={venueLabel} today={today} openingReady={openingReady} linkLabel="Voir le site officiel" />
              </div>
            ))}
          </div>
        </section>
      ) : programView === "interexpo" ? (
        <section className="useful-expo-schedule grand-palais-program-panel grand-palais-interexpo-panel" id="grand-palais-interexpo" aria-labelledby="grand-palais-interexpo-title">
          <div className="useful-expo-schedule-heading">
            <span className="step-label">Galeries 3–4 · 8 · 7</span>
            <h3 id="grand-palais-interexpo-title">Périodes d’inter expos</h3>
            {interExhibitionPeriods.length ? null : <p>Aucune période sans exposition ouverte dans les trois galeries.</p>}
          </div>
          <div className="grand-palais-interexpo-list">
            {interExhibitionPeriods.length ? interExhibitionPeriods.map((period, index) => {
              const detail = describeInterExhibitionPeriod(period, today);
              // Une période en cours montre où on en est, comme une exposition.
              const elapsed = detail.status === "En cours"
                ? Math.min(detail.durationDays, dayDistance(period.startsOn, today) + 1)
                : 0;
              const openFrom = index === 0 ? today : addIsoDays(interExhibitionPeriods[index - 1].endsOn, 1);
              const openTo = addIsoDays(period.startsOn, -1);
              const leadIn = interExhibitionLeadIns[index] ?? [];
              const range = interExhibitionRangeLabel(period);
              // Pastille numérotée, en haut à droite de l'encadré de la période.
              const number = <b className="grand-palais-interexpo-number">{index + 1}</b>;
              // La coupure : « 64 jours de fermeture du 2 août au 4 octobre 2027 ».
              const cut = (
                <article className="grand-palais-interexpo-cut" data-status={detail.status}>
                  {/* Un musée aux portes closes : les galeries sont fermées. */}
                  <svg className="grand-palais-interexpo-art" viewBox="0 0 48 48" aria-hidden="true">
                    <path className="grand-palais-interexpo-art-roof" d="M6 18 24 8l18 10Z" />
                    <circle cx="24" cy="14" r="1.6" />
                    <path d="M8 18h32M11.5 21v13M17 21v13M31 21v13M36.5 21v13M7 34h34M5 38.5h38" />
                    <rect className="grand-palais-interexpo-art-door" x="21" y="24" width="6" height="10" rx="3" />
                  </svg>
                  {leadIn.length ? null : number}
                  {/* La durée, en chiffre, à droite de l'encadré. */}
                  <p className="grand-palais-interexpo-length"><b>{detail.durationDays}</b> <small>jours de fermeture</small></p>
                  <p className="grand-palais-interexpo-kind">Inter-expo</p>
                  {/* À la ligne, « au … » reste d'un seul tenant. */}
                  <strong className="grand-palais-interexpo-cut-range">
                    {range.includes(" au ") ? <>{range.slice(0, range.indexOf(" au "))} <span style={{ whiteSpace: "nowrap" }}>{range.slice(range.indexOf(" au ") + 1)}</span></> : range}
                  </strong>
                  <p className="grand-palais-interexpo-when">
                    <em>{detail.status}</em> <DelayText long={detail.timing} short={detail.shortTiming} />
                  </p>
                  {elapsed ? (
                    <div className="grand-palais-interexpo-progress-row">
                      <span className="grand-palais-interexpo-progress" aria-hidden="true">
                        <i style={{ width: `${Math.round((elapsed / detail.durationDays) * 100)}%` }} />
                      </span>
                      <small>Jour {elapsed} sur {detail.durationDays}</small>
                    </div>
                  ) : null}
                </article>
              );
              return (
                <Fragment key={`${period.startsOn}-${period.endsOn}`}>
                {/* Un encadré par programmation établie dans les trois galeries :
                    une liste resserrée, puis la coupure qui la termine, mise en
                    avant. Une coupure déjà commencée reste seule. */}
                {leadIn.length ? (
                  <section className="grand-palais-interexpo-open" aria-label={`Programmation ${index === 0 ? `jusqu’au ${leadInDay(openTo, today)}` : `à partir du ${leadInDay(openFrom, today)}`}`}>
                    {number}
                    <header>
                      <em>Programmation</em>
                      <strong>{index === 0 ? `Jusqu’au ${leadInDay(openTo, today)}` : `À partir du ${leadInDay(openFrom, today)}`}</strong>
                    </header>
                    <ul>
                      {leadIn.map((item) => (
                        <li key={`${item.venueKey}-${item.title}-${item.startsOn}`} style={grandPalaisVenueStyle(item.venueKey)}>
                          <span>{item.title}</span>
                          <b>{item.venueLabel.replace("Galeries 3 et 4", "Galerie 3/4")}</b>
                          <small>{leadInDates(item, today)}</small>
                        </li>
                      ))}
                    </ul>
                    {cut}
                  </section>
                ) : cut}
                </Fragment>
              );
            }) : <p className="empty-state">Aucune période commune calculable pour le moment.</p>}
            {interExhibitionTail.length ? (
              <section className="grand-palais-interexpo-open" aria-label={`Programmation à partir du ${leadInDay(addIsoDays(interExhibitionPeriods[interExhibitionPeriods.length - 1].endsOn, 1), today)}`}>
                <b className="grand-palais-interexpo-number">{interExhibitionPeriods.length + 1}</b>
                <header>
                  <em>Programmation</em>
                  <strong>À partir du {leadInDay(addIsoDays(interExhibitionPeriods[interExhibitionPeriods.length - 1].endsOn, 1), today)}</strong>
                </header>
                <ul>
                  {interExhibitionTail.map((item) => (
                    <li key={`${item.venueKey}-${item.title}-${item.startsOn}`} style={grandPalaisVenueStyle(item.venueKey)}>
                      <span>{item.title}</span>
                      <b>{item.venueLabel.replace("Galeries 3 et 4", "Galerie 3/4")}</b>
                      <small>{leadInDates(item, today)}</small>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </section>
      ) : programView === "now" || programView === "upcoming" ? (
        <section className="useful-expo-schedule grand-palais-program-panel" aria-live="polite">
          <div className="useful-expo-schedule-heading">
            <h3>{programView === "now" ? "Ouvert en ce moment" : "Prochaines ouvertures"}</h3>
            {/* « En ce moment » se passe de commentaire : la liste parle. */}
            {programView === "upcoming" && overviewEntries.length ? (
              <p>{overviewEntries.length} ouverture{overviewEntries.length > 1 ? "s" : ""} annoncée{overviewEntries.length > 1 ? "s" : ""}, mois par mois.</p>
            ) : null}
          </div>
          <div className="useful-expo-timeline">
            {overviewEntries.length ? overviewEntries.map(({ entry, venueKey, venueLabel, heading }, index) => (
              <div className="expo-card-slot" key={`${venueKey}-${entry.title}-${entry.period}`}>
                {heading && heading !== (index > 0 ? overviewEntries[index - 1].heading : "") ? (
                  <h4 className="expo-month-heading">{heading}</h4>
                ) : null}
                <ExpoCard entry={entry} venueKey={venueKey} venueLabel={venueLabel} today={today} openingReady={openingReady} linkLabel="Voir le site officiel" />
              </div>
            )) : <p className="empty-state">Aucune exposition ne correspond à cette vue.</p>}
          </div>
        </section>
      ) : (
      <section ref={venuePanelRef} className="useful-expo-schedule grand-palais-program-panel grand-palais-venue-panel" aria-label={`Programmation ${venue.label}`}>
        <div className="useful-expo-schedule-heading">
          <span className="step-label">{venue.heading}</span>
          <h3>{venue.label}</h3>
          {venueTotal ? null : <p>Rien d’annoncé pour l’instant.</p>}
        </div>

        {yearGroups.length ? yearGroups.map((group) => (
          <section key={group.year} className="expo-year-group" aria-label={`${venue.label} - ${group.year}`}>
            <h4 className="expo-year-heading">
              <span>{group.year}</span>
              <small>{group.entries.length} exposition{group.entries.length > 1 ? "s" : ""}</small>
            </h4>
            <div className="useful-expo-timeline">
              {group.entries.map((entry) => (
                <ExpoCard
                  key={`${entry.title}-${entry.period}`}
                  entry={entry}
                  venueKey={selectedVenueKey}
                  today={today}
                  openingReady={openingReady}
                  linkLabel="Voir sur le site du Grand Palais"
                />
              ))}
            </div>
          </section>
        )) : (
          <div className="useful-expo-timeline">
            <p className="empty-state">Aucune exposition ne correspond à cette vue.</p>
          </div>
        )}

      </section>
      )}
    </section>
  );
}
