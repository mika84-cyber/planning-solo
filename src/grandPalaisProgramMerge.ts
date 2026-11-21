import { grandPalaisTitleKey } from "./grandPalaisProgramData";
import type { GrandPalaisProgramData, GrandPalaisProgramEntry } from "./grandPalaisProgramData";
import type { GrandPalaisPrice, SharedGrandPalaisEvent } from "./grandPalaisProgramTypes";

/** Le programme livré avec l'application, mis à jour par ce que
 *  l'administrateur a validé dans la veille du site officiel.
 *
 *  Sorti de GrandPalaisProgramSection (21 novembre 2026) : l'accueil annonce
 *  les expositions qui ouvrent et qui ferment (ExpoHomeNotices) et doit lire
 *  le même programme que les Expos, sans charger tout leur écran. */

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

export function formatFrenchDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

/** Deux écritures du même événement : même fiche officielle, même titre, ou
 *  des titres qui se contiennent (« Paris Photo 2026 » dans « Paris Photo
 *  World Supreme ») à peu près aux mêmes dates (`sameSpan`). Sans cela, une
 *  mise à jour acceptée sous un titre un peu différent s'ajoutait à l'entrée
 *  livrée au lieu de la remplacer : deux cartes pour la même patinoire. */
type SharedEventIdentity = { title: string; officialUrl: string; startDate: string; endDate: string };

function overlaps(entry: GrandPalaisProgramEntry, shared: SharedEventIdentity) {
  return !entry.startsOn || !entry.endsOn || (shared.startDate <= entry.endsOn && entry.startsOn <= shared.endDate);
}

/** Deux périodes dont les jours communs couvrent au moins la moitié de la
 *  plus longue. Une soirée d'ouverture d'un soir, pendant les trois mois de
 *  son exposition, en reprend le titre (« Soirée d'ouverture ! Exposition
 *  "Girls…" ») : c'est un autre événement, qui s'ajoute à l'exposition au
 *  lieu de la remplacer. */
export function sameSpan(startA: string, endA: string, startB: string, endB: string) {
  const day = (key: string) => Date.parse(`${key}T12:00:00Z`) / 86_400_000;
  const common = Math.min(day(endA), day(endB)) - Math.max(day(startA), day(startB)) + 1;
  return common * 2 >= Math.max(day(endA) - day(startA), day(endB) - day(startB)) + 1;
}

function isSameGrandPalaisEvent(entry: GrandPalaisProgramEntry, shared: SharedEventIdentity) {
  if (entry.officialUrl === shared.officialUrl || entry.title.toLowerCase() === shared.title.toLowerCase()) return true;
  const known = grandPalaisTitleKey(entry.title);
  const candidate = grandPalaisTitleKey(shared.title);
  return Boolean(known && candidate && (known.includes(candidate) || candidate.includes(known)))
    && (!entry.startsOn || !entry.endsOn || sameSpan(entry.startsOn, entry.endsOn, shared.startDate, shared.endDate));
}

/** La fiche précise qu'un retrait validé vise : même page officielle, ou même
 *  titre à des dates qui se chevauchent. Le rapprochement souple des titres
 *  (`isSameGrandPalaisEvent`) sert aux mises à jour ; appliqué à un retrait,
 *  il effaçait la fiche renommée qui remplace l'ancienne : le retrait de
 *  « Gilles Caron » (page disparue) emportait « Gilles Caron. J'ai voulu
 *  voir », sa nouvelle page, validée deux minutes plus tôt. */
function isWithdrawnGrandPalaisEvent(entry: GrandPalaisProgramEntry, shared: SharedEventIdentity) {
  return entry.officialUrl === shared.officialUrl
    || (entry.title.toLowerCase() === shared.title.toLowerCase() && overlaps(entry, shared));
}

export function remotePeriod(event: SharedGrandPalaisEvent) {
  if (event.startDate === event.endDate) return `Date officielle : ${formatFrenchDate(event.startDate)}`;
  return `Du ${formatFrenchDate(event.startDate)} au ${formatFrenchDate(event.endDate)}`;
}

/** Les tarifs relus — par la veille ou validés depuis une proposition —
 *  remplacent ceux livrés ; mais une gratuité que l'administrateur a voulu
 *  lisible (showFreePrices) et que la relecture ne dit pas reste à la suite :
 *  la fiche officielle du Musée imaginaire d'Oli n'annonce aucun tarif, seule
 *  sa billetterie vend le billet des moins de 5 ans à 0 €. */
export function withKnownFreePrices(prices: GrandPalaisPrice[], known: GrandPalaisProgramEntry | undefined) {
  if (!known?.showFreePrices) return prices;
  const labels = new Set(prices.map((price) => price.label.trim().toLowerCase()));
  const kept = (known.prices ?? []).filter((price) => price.amount === 0 && !labels.has(price.label.trim().toLowerCase()));
  return kept.length ? [...prices, ...kept] : prices;
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
    const matches = (entry: GrandPalaisProgramEntry) => shared.deleted
      ? isWithdrawnGrandPalaisEvent(entry, identity)
      : isSameGrandPalaisEvent(entry, identity);
    // L'entrée livrée que cette mise à jour remplace : ses tarifs, si la
    // fiche a été relue avant de les publier, son audioguide, son site de
    // billetterie et sa condition de tarif, que le site ne dit pas, restent.
    const replaced = Object.values(merged)
      .flatMap((venue) => Object.values(venue.schedule).flatMap((entries) => entries ?? []))
      .filter(matches);
    const knownEntry = replaced.find((entry) => entry.prices?.length);
    const knownPrices = knownEntry?.prices;
    const known = <K extends keyof GrandPalaisProgramEntry>(field: K) => replaced.find((entry) => entry[field])?.[field];
    for (const venue of Object.values(merged))
      for (const year of Object.keys(venue.schedule))
        venue.schedule[Number(year)] = (venue.schedule[Number(year)] ?? []).filter((entry) => !matches(entry));
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
    const showFreePrices = known("showFreePrices");
    const entry: GrandPalaisProgramEntry = {
      title: shared.title,
      ...(shared.details ? { details: shared.details } : {}),
      period: remotePeriod(shared),
      officialUrl,
      startsOn: shared.startDate,
      endsOn: shared.endDate,
      ...(shared.prices?.length ? { prices: withKnownFreePrices(shared.prices, knownEntry) } : knownPrices ? { prices: knownPrices } : {}),
      ...(ticketingUrl ? { ticketingUrl } : {}),
      ...(audioguide ? { audioguide } : {}),
      ...(priceNote ? { priceNote } : {}),
      ...(priceGroupHours ? { priceGroupHours } : {}),
      ...(showFreePrices ? { showFreePrices } : {}),
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
