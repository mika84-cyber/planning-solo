import { grandPalaisTitleKey, type GrandPalaisProgramData } from "./grandPalaisProgramData";

/** Les espaces dont une exposition s'annonce sur l'accueil : les galeries
 *  d'exposition, le Palais des enfants, puis la Nef (demandes de
 *  l'administrateur, le 21 novembre 2026) ; pas les salons. Dans l'ordre où
 *  il les a cités. La Galerie 6.1 n'existe que par la veille du site, d'où
 *  sa clé. */
export const EXPO_NOTICE_VENUES = [
  "galleries34",
  "gallery7",
  "gallery8",
  "gallery910",
  "other:galerie-6-1",
  "childrenPalace",
  "nef",
];

/** Deux messages par exposition, pas davantage : la veille de l'ouverture,
 *  puis sept jours avant la fin. Chacun reste tant qu'il n'est pas lu,
 *  jusqu'au jour de l'ouverture ou au dernier jour, pour qui n'ouvre pas
 *  l'application ce jour-là.
 *
 *  Une exposition d'une semaine ou moins (un salon de la Nef) n'a que le
 *  message de la veille, qui dit combien de jours elle reste ouverte : sept
 *  jours avant sa fin, elle n'a pas encore ouvert. */
export const EXPO_NOTICE_DAYS = 7;

export type ExpoNotice = {
  /** Ce que retient « Compris » : le sens, l'espace, la date et le titre. */
  id: string;
  kind: "opening" | "closing";
  venueLabel: string;
  title: string;
  /** Le jour d'ouverture, ou le dernier jour de l'exposition. */
  date: string;
  /** Jours restants avant l'ouverture (1 ou 0), ou avant la fermeture. */
  days: number;
  /** Pour une ouverture : le dernier jour de l'exposition, s'il est connu. */
  until?: string;
  /** Pour une exposition d'une semaine ou moins : ses jours d'ouverture. */
  openDays?: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayDistance(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Les ouvertures et les fermetures à annoncer ce jour-là, de la plus ancienne
 *  à la plus lointaine. Une exposition à cheval sur deux années, écrite dans
 *  les deux, ne s'annonce qu'une fois ; une exposition « à confirmer » ne
 *  s'annonce pas. */
export function computeExpoNotices(program: GrandPalaisProgramData, today: string): ExpoNotice[] {
  const notices = new Map<string, ExpoNotice>();
  if (!DAY.test(today)) return [];
  for (const venueKey of EXPO_NOTICE_VENUES) {
    const venue = program[venueKey];
    if (!venue) continue;
    for (const entry of Object.values(venue.schedule).flatMap((entries) => entries ?? [])) {
      if (entry.uncertain) continue;
      const add = (kind: ExpoNotice["kind"], date: string, days: number, rest?: Pick<ExpoNotice, "until" | "openDays">) => {
        const id = `${kind}:${venueKey}:${date}:${grandPalaisTitleKey(entry.title)}`;
        if (!notices.has(id)) notices.set(id, { id, kind, venueLabel: venue.label, title: entry.title, date, days, ...rest });
      };
      const starts = entry.startsOn && DAY.test(entry.startsOn) ? entry.startsOn : undefined;
      const ends = entry.endsOn && DAY.test(entry.endsOn) ? entry.endsOn : undefined;
      const openDays = starts && ends ? dayDistance(starts, ends) + 1 : undefined;
      const short = openDays !== undefined && openDays > 0 && openDays <= EXPO_NOTICE_DAYS;
      if (starts) {
        const days = dayDistance(today, starts);
        if (days === 0 || days === 1) add("opening", starts, days, { until: ends, openDays: short ? openDays : undefined });
      }
      if (ends && !short) {
        const days = dayDistance(today, ends);
        if (days >= 0 && days <= EXPO_NOTICE_DAYS) add("closing", ends, days);
      }
    }
  }
  return [...notices.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function frenchDay(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(/(^|\s)1 /, "$11er ");
}

/** « Ouverture demain », « Fermeture dans 7 jours »… */
export function expoNoticeHeading({ kind, days }: ExpoNotice) {
  if (kind === "opening") return days === 0 ? "Ouverture aujourd’hui" : "Ouverture demain";
  if (days === 0) return "Dernier jour aujourd’hui";
  if (days === 1) return "Fermeture demain";
  return `Fermeture dans ${days} jours`;
}

/** La précision sous le titre : jusqu'à quand l'exposition reste ouverte (et
 *  combien de jours, si elle est courte), ou quel jour elle ferme. */
export function expoNoticeDetail({ kind, days, date, until, openDays }: ExpoNotice) {
  if (kind === "opening") {
    if (!until) return "";
    if (openDays === 1) return "Ouvert une seule journée";
    if (openDays) return `Ouvert ${openDays} jours, jusqu’au ${frenchDay(until, { weekday: "long", day: "numeric", month: "long" })}`;
    return `Jusqu’au ${frenchDay(until, { day: "numeric", month: "long", year: "numeric" })}`;
  }
  return days === 0 ? "" : `Dernier jour : ${frenchDay(date, { weekday: "long", day: "numeric", month: "long" })}`;
}
