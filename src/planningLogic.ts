export type DayKind = "work" | "off" | "training";
export type LeaveType =
  | "annual"
  | "rtt"
  | "fraction"
  | "half"
  | "recovery"
  | "sick"
  | "strike"
  | "cet"
  | "other"
  | "childcare"
  | "exceptional";
export type SelectionType =
  | "annual"
  | "half"
  | "rtt"
  | "fraction"
  | "recovery"
  | "sick"
  | "strike"
  | "cet"
  | "other"
  | "childcare"
  | "exceptional"
  | "recovery_day"
  | "recovery_half"
  | "recovery_hours"
  | "recovery_holiday"
  | "recovery_training";
/** Moitié de journée posée. Une demi-journée sans moment reste possible : les
 *  demandes venues du formulaire n'en portent pas. */
export type HalfMoment = "morning" | "afternoon";
export const HALF_MOMENT_OPTIONS: Array<{ value: HalfMoment; label: string }> = [
  { value: "morning", label: "Matin" },
  { value: "afternoon", label: "Après-midi" },
];
/** Déduit la moitié posée de l'heure de début choisie dans le formulaire :
 *  avant 13 h 30, la demi-journée est celle du matin, à partir de 13 h 30
 *  celle de l'après-midi. Les deux exemples type — 9 h 15-13 h 30 et
 *  13 h 30-17 h 30 — partagent cette heure pivot, d'où la comparaison au
 *  début plutôt qu'au milieu de la plage. */
export function halfMomentFromStart(start: string): HalfMoment {
  return start < "13:30" ? "morning" : "afternoon";
}
/** Ce que porte une date sélectionnée sur plusieurs jours : un congé, une
 *  note libre, ou un congé seulement souhaité. */
export type MultiDatePerson = "leave" | "personal" | "wish";

export type DayInfo = { kind: DayKind; holiday: string; selectable: boolean };

export const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
export const SHORT_DAYS = ["L", "M", "M", "J", "V", "S", "D"];
export const CYCLE_ANCHOR = Date.UTC(2026, 6, 31);
export const CYCLE_ANCHOR_INDEX: Record<number, number> = { 1: 3, 2: 10, 3: 17 };
export const CYCLE_TYPES: DayKind[] = [
  "work",
  "work",
  "work",
  "work",
  "work",
  "work",
  "off",
  "off",
  "training",
  "work",
  "work",
  "work",
  "work",
  "off",
  "work",
  "work",
  "off",
  "off",
  "off",
  "off",
  "off",
];
export const DAY_LABELS: Record<DayKind, string> = {
  work: "Travail",
  off: "Repos",
  training: "Formation",
};
export const TYPE_LABELS: Record<SelectionType, string> = {
  annual: "Congés annuels",
  half: "Congés en demi-journée",
  rtt: "RTT",
  fraction: "Jour de fractionnement",
  recovery: "Récupération",
  sick: "Maladie",
  strike: "Grève",
  cet: "Congé CET",
  other: "Divers",
  childcare: "Congé garde d’enfant",
  exceptional: "Jour exceptionnel",
  recovery_day: "Récupération en journée",
  recovery_half: "Récupération en demi-journée",
  recovery_hours: "Récupération en heures",
  recovery_holiday: "Récupération jour férié",
  recovery_training: "Formation",
};
export const TYPE_COLORS: Record<SelectionType, string> = {
  annual: "#6cbdf0",
  half: "#6cbdf0",
  rtt: "#72b7ad",
  fraction: "#c9a6ea",
  recovery: "#e08a1e",
  sick: "#c2557a",
  strike: "#f28b82",
  cet: "#4f9fe6",
  other: "#e58aa5",
  childcare: "#0891b2",
  exceptional: "#854d0e",
  recovery_day: "#2f68d1",
  recovery_half: "#7957c7",
  recovery_hours: "#c64f62",
  recovery_holiday: "#b87518",
  recovery_training: "#2f68d1",
};
/** Maladie, garde d'enfant et jours exceptionnels n'ouvrent aucun droit :
    ils sont comptés, jamais décomptés du solde de congés. */
export const LEAVE_ALLOWANCES: Record<LeaveType, number> = {
  annual: 29,
  rtt: 15,
  fraction: 2,
  half: 0,
  // Une récupération rend des heures déjà travaillées : elle ne consomme
  // aucun droit et n'entre dans aucune brique de solde.
  recovery: 0,
  sick: 0,
  strike: 0,
  cet: 0,
  other: 0,
  childcare: 0,
  exceptional: 0,
};
/** Types suivis sans quota : comptés à part du solde de congés. */
export const COUNTED_ONLY_TYPES = [
  "sick",
  "strike",
  "childcare",
  "exceptional",
  "other",
  "cet",
] as const satisfies readonly LeaveType[];
export type CountedOnlyType = (typeof COUNTED_ONLY_TYPES)[number];
export const LEAVE_TYPE_OPTIONS: Array<{ value: LeaveType; label: string }> = [
  { value: "annual", label: "Congé annuel" },
  { value: "rtt", label: "RTT" },
  { value: "fraction", label: "Fractionnement" },
  { value: "half", label: "Demi-journée" },
  { value: "recovery", label: "Récupération" },
  { value: "sick", label: "Maladie" },
  { value: "strike", label: "Grève" },
  { value: "cet", label: "Congé CET" },
  { value: "other", label: "Divers" },
  { value: "childcare", label: "Garde d’enfant" },
  { value: "exceptional", label: "Jour exceptionnel" },
];
export const GROUP_OPTIONS = [1, 2, 3].map((value) => ({
  value,
  label: `Groupe ${value}`,
}));
export const YEAR_OPTIONS = Array.from({ length: 25 }, (_, index) => ({
  value: 2026 + index,
  label: String(2026 + index),
}));
export const MONTH_OPTIONS = MONTHS.map((label, value) => ({ value, label }));

export type SchoolVacation = { name: string; from: string; to: string };
export type SchoolZone = "A" | "B" | "C";
export const SCHOOL_ZONE_OPTIONS: Array<{ value: SchoolZone; label: string }> =
  [
    { value: "A", label: "Zone A" },
    { value: "B", label: "Zone B" },
    { value: "C", label: "Zone C" },
  ];

/** Toussaint, Noël et été sont les mêmes trois dates pour les trois zones ;
 *  seuls hiver et printemps diffèrent. Dates officielles (education.gouv.fr,
 *  vérifiées le 16 août 2026) : la date de fin indiquée par les calendriers
 *  scolaires est celle de la reprise des cours, pas un jour de vacances —
 *  chaque période est donc bornée à la veille de la reprise. */
const SCHOOL_VACATIONS_SHARED: SchoolVacation[] = [
  { name: "Vacances de Noël", from: "2025-12-20", to: "2026-01-04" },
  { name: "Vacances d’été", from: "2026-07-04", to: "2026-08-31" },
  { name: "Vacances de la Toussaint", from: "2026-10-17", to: "2026-11-01" },
  { name: "Vacances de Noël", from: "2026-12-19", to: "2027-01-03" },
  { name: "Vacances d’été", from: "2027-07-03", to: "2027-09-01" },
  { name: "Vacances de la Toussaint", from: "2027-10-23", to: "2027-11-07" },
  { name: "Vacances de Noël", from: "2027-12-18", to: "2028-01-02" },
  { name: "Vacances d’été", from: "2028-07-04", to: "2028-08-31" },
];
const SCHOOL_VACATIONS_BY_ZONE: Record<SchoolZone, SchoolVacation[]> = {
  A: [
    { name: "Vacances d’hiver", from: "2026-02-07", to: "2026-02-22" },
    { name: "Vacances de printemps", from: "2026-04-04", to: "2026-04-19" },
    { name: "Vacances d’hiver", from: "2027-02-13", to: "2027-02-28" },
    { name: "Vacances de printemps", from: "2027-04-10", to: "2027-04-25" },
    { name: "Vacances d’hiver", from: "2028-02-19", to: "2028-03-05" },
    { name: "Vacances de printemps", from: "2028-04-22", to: "2028-05-08" },
  ],
  B: [
    { name: "Vacances d’hiver", from: "2026-02-14", to: "2026-03-01" },
    { name: "Vacances de printemps", from: "2026-04-11", to: "2026-04-26" },
    { name: "Vacances d’hiver", from: "2027-02-20", to: "2027-03-07" },
    { name: "Vacances de printemps", from: "2027-04-17", to: "2027-05-02" },
    { name: "Vacances d’hiver", from: "2028-02-05", to: "2028-02-20" },
    { name: "Vacances de printemps", from: "2028-04-08", to: "2028-04-23" },
  ],
  C: [
    { name: "Vacances d’hiver", from: "2026-02-21", to: "2026-03-08" },
    { name: "Vacances de printemps", from: "2026-04-18", to: "2026-05-03" },
    { name: "Vacances d’hiver", from: "2027-02-06", to: "2027-02-21" },
    { name: "Vacances de printemps", from: "2027-04-03", to: "2027-04-18" },
    { name: "Vacances d’hiver", from: "2028-02-12", to: "2028-02-27" },
    { name: "Vacances de printemps", from: "2028-04-15", to: "2028-05-01" },
  ],
};

export function schoolVacationsForZone(zone: SchoolZone): SchoolVacation[] {
  return [...SCHOOL_VACATIONS_SHARED, ...SCHOOL_VACATIONS_BY_ZONE[zone]].sort(
    (a, b) => a.from.localeCompare(b.from),
  );
}

export function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12, 0, 0, 0);
}
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function fromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return localDate(year, month - 1, day);
}
export function addDays(date: Date, count: number) {
  return localDate(date.getFullYear(), date.getMonth(), date.getDate() + count);
}
export function dayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
}
export function sameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
export function longDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
export function shortDate(key: string) {
  const date = fromKey(key);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}
export function dateTimeLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
export function easterSunday(year: number) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4;
  const f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return localDate(year, month - 1, day);
}
export function holidaysForYear(year: number) {
  const easter = easterSunday(year);
  const values: Array<[Date, string]> = [
    [localDate(year, 0, 1), "Jour de l’an"],
    [easter, "Dimanche de Pâques"],
    [addDays(easter, 1), "Lundi de Pâques"],
    [localDate(year, 4, 1), "Fête du Travail"],
    [localDate(year, 4, 8), "Victoire 1945"],
    [addDays(easter, 39), "Ascension"],
    [addDays(easter, 49), "Dimanche de Pentecôte"],
    [addDays(easter, 50), "Lundi de Pentecôte"],
    [localDate(year, 6, 14), "Fête nationale"],
    [localDate(year, 7, 15), "Assomption"],
    [localDate(year, 10, 1), "Toussaint"],
    [localDate(year, 10, 11), "Armistice 1918"],
    [localDate(year, 11, 25), "Noël"],
  ];
  return Object.fromEntries(
    values.map(([date, name]) => [dateKey(date), name]),
  );
}
const holidayCache: Record<number, Record<string, string>> = {};
export function holidayName(date: Date) {
  holidayCache[date.getFullYear()] ??= holidaysForYear(date.getFullYear());
  return holidayCache[date.getFullYear()][dateKey(date)] || "";
}
export function isAlwaysOffHoliday(date: Date) {
  return (
    (date.getMonth() === 4 && date.getDate() === 1) ||
    (date.getMonth() === 6 && date.getDate() === 14) ||
    (date.getMonth() === 11 && date.getDate() === 25)
  );
}
export function baseKind(date: Date, group: number): DayKind {
  const delta = dayNumber(date) - Math.floor(CYCLE_ANCHOR / 86400000);
  const index = (((CYCLE_ANCHOR_INDEX[group] + delta) % 21) + 21) % 21;
  return CYCLE_TYPES[index];
}
export function getDayInfo(date: Date, group: number): DayInfo {
  const holiday = holidayName(date);
  const base = baseKind(date, group);
  if (holiday && (isAlwaysOffHoliday(date) || base === "training"))
    return { kind: "off", holiday, selectable: false };
  return { kind: base, holiday, selectable: base !== "off" };
}

/** Groupes qui travaillent réellement avec le groupe choisi à cette date.
 * Les groupes en formation sont volontairement exclus. Si le groupe choisi
 * est lui-même en formation, aucun autre groupe n'est annoncé. */
export function coWorkingGroupsForDate(date: Date, group: number) {
  if (getDayInfo(date, group).kind !== "work") return [];
  return GROUP_OPTIONS.map((option) => option.value).filter(
    (candidateGroup) =>
      candidateGroup !== group && getDayInfo(date, candidateGroup).kind === "work",
  );
}

/** Renvoie le prochain jour où l'utilisatrice doit se rendre au travail.
 * Une formation fait partie des jours de présence, au même titre qu'un jour
 * de travail classique. Le passage par `getDayInfo` conserve les exceptions
 * du cycle, notamment une formation annulée par un jour férié non travaillé. */
export function nextAttendanceDay(
  from: Date,
  group: number,
  isUnavailable: (key: string) => boolean = () => false,
  maxDays = 366,
) {
  for (let offset = 1; offset <= maxDays; offset++) {
    const candidate = addDays(from, offset);
    const kind = getDayInfo(candidate, group).kind;
    if ((kind === "work" || kind === "training") && !isUnavailable(dateKey(candidate)))
      return candidate;
  }
  return null;
}
export function wasPompidouHolidayWorked(date: Date, group: number) {
  if (!holidayName(date)) return false;
  if (date.getMonth() === 4 && date.getDate() === 1) return false;
  return baseKind(addDays(date, -1), group) === "work";
}
export function monthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Les tiers de l'année tels que le service les compte : quatre mois, puis
 *  cinq, puis trois. Ils ne sont donc pas de longueur égale, et un tiers ne
 *  vaut pas quatre mois glissants. */
export const YEAR_THIRDS = [
  { label: "1er tiers", firstMonth: 0, lastMonth: 3 },
  { label: "2e tiers", firstMonth: 4, lastMonth: 8 },
  { label: "3e tiers", firstMonth: 9, lastMonth: 11 },
] as const;
export type YearThird = (typeof YEAR_THIRDS)[number];

export function yearThirdFor(month: number): YearThird {
  return (
    YEAR_THIRDS.find(
      (third) => month >= third.firstMonth && month <= third.lastMonth,
    ) ?? YEAR_THIRDS[0]
  );
}

/** « janvier → avril » : situe le tiers sans avoir à en connaître le découpage. */
export function yearThirdRange(third: YearThird) {
  return `${MONTHS[third.firstMonth]} → ${MONTHS[third.lastMonth]}`;
}

/* ================= indemnités dominicale et de jour férié ================= */

/** Barème de l'indemnité dominicale, en euros.
 *
 *  Les dix premiers dimanches sont couverts par un forfait annuel versé par
 *  douzièmes, acquis quoi qu'il arrive. Du onzième au trente-et-unième, chaque
 *  dimanche travaillé s'ajoute. Au-delà du trente-et-unième, rien : ils ne sont
 *  pas majorés. Les dimanches fériés en sont exclus — ils relèvent de
 *  l'indemnité de jour férié.
 */
export const SUNDAY_ALLOWANCE = {
  /** Forfait annuel des dix premiers dimanches. */
  yearlyFlat: 1075.05,
  /** Le douzième mensuel de ce forfait, tel qu'il figure sur la paie. */
  monthlyFlat: 89.59,
  /** Dernier dimanche couvert par le forfait. */
  flatUntil: 10,
  /** Dernier dimanche indemnisé : au-delà, plus rien. */
  paidUntil: 31,
  perSunday: 54.93,
} as const;

/** Écart confirmé par un bulletin entre les dimanches attendus et réellement
 * payés. Le bulletin fait foi pour le net du mois ; les jours manquants restent
 * dus et seront reportés sur le prochain rappel. */
export function unpaidSundays(expected: number, paid: number) {
  return Math.max(0, Math.round(expected) - Math.round(paid));
}

/** Coefficients de l'indemnité de jour férié travaillé, à multiplier par le
 *  traitement de base mensuel : `coefficient × traitement × 1,18 / 30`. */
export const HOLIDAY_ALLOWANCE = {
  /** Prime seule. */
  prime: 3.59,
  /** Prime minorée, assortie d'un jour de récupération.
   *
   *  Attention : jusqu'en février 2026, les bulletins ont payé cette variante
   *  à 2,514 — sept lignes « Indem trav jf ac récup ac pc » entre avril 2024
   *  et janvier 2026 le montrent, sur trois traitements différents. C'était
   *  une erreur de l'administration, qu'elle a rattrapée en mars et mai 2026
   *  par neuf lignes d'ajustement de 5,47 à 5,53 € — soit exactement
   *  (2,59 − 2,514) × traitement × 1,18 / 30 pour chaque férié concerné.
   *
   *  Le coefficient est donc bien 2,59, et les vieux bulletins ne doivent pas
   *  servir à le « corriger » : ils portent le montant d'avant rattrapage. */
  recovery: 2.59,
  chargeRate: 1.18,
  daysPerMonth: 30,
} as const;

/** Indemnité de résidence : 3 % du traitement de base, d'après la grille
 *  affichée dans les locaux — commune aux deux tableaux (contractuels et
 *  fonctionnaires), contrairement à l'IFSE qui n'apparaît que sous celui des
 *  fonctionnaires. Les indemnités dominicale et de jour férié ci-dessus
 *  viennent de la même grille et n'y sont pas non plus scindées par statut :
 *  les deux coefficients s'appliquent donc tels quels aux deux statuts. */
export const RESIDENCE_ALLOWANCE_RATE = 0.03;

/** Les socles du barème dominical, tels que le document les présente. Les deux
 *  socles indemnisés partagent le même taux ; ils restent distincts parce que
 *  c'est ainsi que la progression se lit. */
export const SUNDAY_TIERS = [
  { label: "forfait des 10 premiers", from: 1, to: 10 },
  { label: "du 11e au 18e", from: 11, to: 18 },
  { label: "du 19e au 31e", from: 19, to: 31 },
  { label: "au-delà du 31e", from: 32, to: Number.POSITIVE_INFINITY },
] as const;

/** Le socle dans lequel tombe le n-ième dimanche travaillé de l'année. */
export function sundayTierFor(rank: number) {
  return (
    SUNDAY_TIERS.find((tier) => rank >= tier.from && rank <= tier.to) ??
    SUNDAY_TIERS[0]
  );
}

export type HolidayPay = "prime" | "recovery";

/** Part retenue par jour d'arrêt maladie, au-delà du jour de carence. */
export const SICK_DAILY_RATE = 0.1;

/** La retenue d'un arrêt maladie.
 *
 *  Le premier jour est un jour de carence : une journée entière, dont le
 *  montant figure sur le bulletin et se saisit dans l'appli — son assiette
 *  comporte un élément que les lignes du bulletin ne permettent pas d'isoler.
 *  Chaque jour suivant coûte 10 % de sa valeur journalière, sur deux assiettes
 *  distinctes : le traitement de base et l'IFSE. Les jours sont calendaires,
 *  et il y a une carence par arrêt.
 */
export function sickLeaveDeduction(
  days: number,
  baseSalary: number,
  ifse: number,
  carenceDay: number,
) {
  if (days <= 0)
    return { carence: 0, reducedDays: 0, perDay: 0, reduction: 0, total: 0 };
  const reducedDays = days - 1;
  const perDay = ((baseSalary + ifse) * SICK_DAILY_RATE) / 30;
  const reduction = reducedDays * perDay;
  return {
    carence: carenceDay,
    reducedDays,
    perDay,
    reduction,
    total: carenceDay + reduction,
  };
}

/** Le montant d'un jour férié travaillé, selon la compensation choisie. */
export function holidayAllowance(baseSalary: number, choice: HolidayPay) {
  const coefficient =
    choice === "prime" ? HOLIDAY_ALLOWANCE.prime : HOLIDAY_ALLOWANCE.recovery;
  return (
    (coefficient * baseSalary * HOLIDAY_ALLOWANCE.chargeRate) /
    HOLIDAY_ALLOWANCE.daysPerMonth
  );
}

/** Le montant dû pour `count` dimanches travaillés dans l'année, forfait des
 *  dix premiers compris. */
export function sundayAllowance(count: number) {
  const paid = Math.max(
    0,
    Math.min(count, SUNDAY_ALLOWANCE.paidUntil) - SUNDAY_ALLOWANCE.flatUntil,
  );
  return {
    flat: SUNDAY_ALLOWANCE.yearlyFlat,
    perSundayCount: paid,
    perSundayTotal: paid * SUNDAY_ALLOWANCE.perSunday,
    /** Dimanches travaillés au-delà du plafond : ils ne rapportent rien. */
    unpaid: Math.max(0, count - SUNDAY_ALLOWANCE.paidUntil),
    total: SUNDAY_ALLOWANCE.yearlyFlat + paid * SUNDAY_ALLOWANCE.perSunday,
  };
}

/** Sur quelle paie tombe un dimanche travaillé au-delà du dixième.
 *
 *  Le mois de décembre est payé en janvier de l'année suivante, d'où le
 *  décalage d'année porté par `year`.
 */
/** Le mois de paie qui porte un jour férié travaillé : toujours le mois
 *  suivant celui du férié. Le 1er janvier fait exception et tombe sur la paie
 *  du mois même. */
export function holidayPayslip(key: string) {
  const month = Number(key.slice(5, 7)) - 1;
  const day = Number(key.slice(8, 10));
  const paid = month === 0 && day === 1 ? 0 : (month + 1) % 12;
  return { label: `paie de ${MONTHS[paid]}`, monthIndex: paid };
}

export function sundayPayslip(key: string): { label: string; order: number } {
  const month = Number(key.slice(5, 7));
  if (month <= 6) return { label: "paie de juillet", order: 0 };
  if (month <= 9) return { label: "paie d’octobre", order: 1 };
  if (month <= 11) return { label: "paie de décembre", order: 2 };
  return { label: "paie de janvier", order: 3 };
}

export type ManualSundayLeaveCounts = {
  janJun: number;
  julSep: number;
  octNov: number;
  dec: number;
};

/** Retire d'une année les dimanches posés avant l'adoption de l'application.
 * Les congés datés ont déjà été écartés en amont : cette reprise ne porte que
 * sur les absences sans date, réparties selon les quatre périodes de paie. */
export function applyManualSundayLeave<T extends { key: string }>(
  sundays: T[],
  counts: ManualSundayLeaveCounts,
) {
  const remaining = { ...counts };
  return sundays.filter((item) => {
    const month = Number(item.key.slice(5, 7));
    const period =
      month <= 6
        ? "janJun"
        : month <= 9
          ? "julSep"
          : month <= 11
            ? "octNov"
            : "dec";
    if (remaining[period] <= 0) return true;
    remaining[period]--;
    return false;
  });
}
export function groupConsecutive(keys: string[]) {
  const sorted = [...new Set(keys)].sort();
  const groups: Array<{ from: string; to: string }> = [];
  for (const key of sorted) {
    const previous = groups.at(-1);
    if (
      previous &&
      dayNumber(fromKey(key)) === dayNumber(fromKey(previous.to)) + 1
    )
      previous.to = key;
    else groups.push({ from: key, to: key });
  }
  return groups;
}

export function periodLabel(from: string, to: string) {
  return from === to
    ? shortDate(from)
    : `Du ${shortDate(from)} au ${shortDate(to)}`;
}
export function multiDatePersonLabel(person: MultiDatePerson) {
  if (person === "personal") return "Divers";
  if (person === "wish") return "Congé souhaité";
  return "Congé";
}
export function leaveTypeLabel(type?: LeaveType | "") {
  return type ? TYPE_LABELS[type] : "Type non renseigné";
}

/** Certains libellés sont déjà au pluriel, d'autres au singulier, et deux sont
 *  invariables (RTT, Maladie). Ce tableau ne garde que ceux qui changent. */
const PLURAL_TYPE_LABELS: Partial<Record<SelectionType, string>> = {
  fraction: "Jours de fractionnement",
  recovery: "Récupérations",
  childcare: "Congés garde d’enfant",
  exceptional: "Jours exceptionnels",
  recovery_day: "Récupérations en journée",
  recovery_half: "Récupérations en demi-journée",
  recovery_hours: "Récupérations en heures",
  recovery_holiday: "Récupérations jour férié",
  recovery_training: "Formations en récupération",
};

/** Le libellé d'un type accordé au nombre d'éléments qu'il compte. */
export function typeLabelFor(type: SelectionType, count: number) {
  if (count < 2) return TYPE_LABELS[type];
  return PLURAL_TYPE_LABELS[type] ?? TYPE_LABELS[type];
}

/** `s(2)` → « s ». Pour accorder au cas par cas, les mots invariables comme
 *  « pris » côtoyant les mots variables dans les mêmes phrases. */
export function s(count: number) {
  return count >= 2 ? "s" : "";
}
