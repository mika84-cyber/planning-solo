import { workScheduleHalfTimes, type WorkSchedule } from "./overtime";
import { addDays, dateKey, fromKey, longDate, type HalfMoment } from "./planningLogic";

/** Règles du temps de travail qu'un mécénat doit respecter :
 *  - 12 heures d'amplitude au plus, de la prise de poste au départ, pauses
 *    comprises ;
 *  - 11 heures de repos au moins entre deux journées de travail ;
 *  - un lundi, pas plus de 6 jours de travail d'affilée. */
export const MECENAT_MAX_AMPLITUDE_MINUTES = 12 * 60;
export const MECENAT_MIN_REST_MINUTES = 11 * 60;
export const MECENAT_MAX_CONSECUTIVE_DAYS = 6;

const DAY = 24 * 60;

export type MecenatDayPresence = {
  status: "work" | "training" | "partial" | "rest" | "absence";
  halfMoment?: HalfMoment;
};

export type MecenatRuleContext = {
  /** Présence prévue ce jour-là, hors mécénat : cycle, échanges, congés. */
  presenceFor: (key: string) => MecenatDayPresence;
  /** Horaires habituels d'une journée de travail. */
  schedule: WorkSchedule;
  /** Mécénats déjà enregistrés. */
  mecenats: Array<{ date: string; start: string; end: string }>;
};

type Interval = { from: number; to: number; label: string };

function clock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function clockLabel(minutes: number) {
  const inDay = ((minutes % DAY) + DAY) % DAY;
  const hours = Math.floor(inDay / 60);
  const rest = inDay % 60;
  return `${hours} h${rest ? ` ${String(rest).padStart(2, "0")}` : ""}`;
}

export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h${rest ? ` ${String(rest).padStart(2, "0")}` : ""}`;
}

/** Plage horaire, en minutes depuis le début du jour `offset`. Une fin plus
 *  tôt que le début passe au lendemain. */
function span(start: string, end: string, offset: number) {
  const from = clock(start);
  const rawTo = clock(end);
  if (from === null || rawTo === null || from === rawTo) return null;
  const to = rawTo <= from ? rawTo + DAY : rawTo;
  return { from: offset * DAY + from, to: offset * DAY + to };
}

/** Ce qui est travaillé un jour donné (poste habituel et mécénats), en
 *  minutes relatives au jour du mécénat étudié. */
function workIntervals(key: string, offset: number, context: MecenatRuleContext, extra?: { start: string; end: string }) {
  const intervals: Interval[] = [];
  const presence = context.presenceFor(key);
  if (presence.status === "work" || presence.status === "training" || presence.status === "partial") {
    // Une demi-journée posée : seule l'autre moitié est travaillée.
    const hours = presence.status === "partial" && presence.halfMoment
      ? workScheduleHalfTimes(context.schedule, presence.halfMoment === "morning" ? "afternoon" : "morning")
      : context.schedule;
    const shift = span(hours.start, hours.end, offset);
    if (shift) intervals.push({ ...shift, label: "poste" });
  }
  for (const item of context.mecenats.filter((entry) => entry.date === key)) {
    const vacation = span(item.start, item.end, offset);
    if (vacation) intervals.push({ ...vacation, label: "mécénat" });
  }
  if (extra) {
    const vacation = span(extra.start, extra.end, offset);
    if (vacation) intervals.push({ ...vacation, label: "ce mécénat" });
  }
  return intervals;
}

function isWorked(key: string, context: MecenatRuleContext) {
  const { status } = context.presenceFor(key);
  return status === "work" || status === "training" || status === "partial"
    || context.mecenats.some((entry) => entry.date === key);
}

function shortDate(key: string) {
  return longDate(fromKey(key)).replace(/ \d{4}$/, "");
}

/** Raisons pour lesquelles ce mécénat ne peut pas être pris ; vide s'il
 *  respecte les trois règles. */
export function mecenatRuleViolations(
  draft: { date: string; start: string; end: string },
  context: MecenatRuleContext,
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !span(draft.start, draft.end, 0)) return [];
  const reasons: string[] = [];
  const day = fromKey(draft.date);
  const previousKey = dateKey(addDays(day, -1));
  const nextKey = dateKey(addDays(day, 1));

  // 1. Amplitude : de la première prise de poste au dernier départ du jour.
  const today = workIntervals(draft.date, 0, context, draft);
  const first = Math.min(...today.map((item) => item.from));
  const last = Math.max(...today.map((item) => item.to));
  if (last - first > MECENAT_MAX_AMPLITUDE_MINUTES) {
    const shift = today.find((item) => item.label === "poste");
    reasons.push(
      `Amplitude de ${durationLabel(last - first)} : votre journée irait de ${clockLabel(first)}${shift && shift.from === first ? " (prise de poste)" : ""} à ${clockLabel(last)}${last >= DAY ? " le lendemain" : ""}, alors que 12 heures au maximum sont autorisées entre l’arrivée et le départ, pauses comprises.`,
    );
  }

  // 2. Repos de 11 heures avec la journée d'avant et celle d'après.
  const before = workIntervals(previousKey, -1, context);
  if (before.length) {
    const previousEnd = Math.max(...before.map((item) => item.to));
    const rest = first - previousEnd;
    if (rest < MECENAT_MIN_REST_MINUTES)
      reasons.push(
        `Repos insuffisant : vous terminez à ${clockLabel(previousEnd)} ${previousEnd > 0 ? `le ${shortDate(draft.date)}` : `le ${shortDate(previousKey)}`}, il ne resterait que ${durationLabel(Math.max(0, rest))} avant de commencer à ${clockLabel(first)}. Il faut au moins 11 heures de repos entre deux journées de travail.`,
      );
  }
  const after = workIntervals(nextKey, 1, context);
  if (after.length) {
    const nextStart = Math.min(...after.map((item) => item.from));
    const rest = nextStart - last;
    if (rest < MECENAT_MIN_REST_MINUTES)
      reasons.push(
        `Repos insuffisant : ce mécénat vous fait finir à ${clockLabel(last)}${last >= DAY ? " dans la nuit" : ""}, il ne resterait que ${durationLabel(Math.max(0, rest))} avant votre prise de poste du ${shortDate(nextKey)} à ${clockLabel(nextStart)}. Il faut au moins 11 heures de repos entre deux journées de travail.`,
      );
  }

  // 3. Un lundi qui n'était pas travaillé ne doit pas créer une série de
  //    plus de 6 jours de travail d'affilée.
  if (day.getDay() === 1 && !isWorked(draft.date, context)) {
    let firstKey = draft.date;
    let lastKey = draft.date;
    for (let step = 1; step <= MECENAT_MAX_CONSECUTIVE_DAYS; step++) {
      const key = dateKey(addDays(day, -step));
      if (!isWorked(key, context)) break;
      firstKey = key;
    }
    for (let step = 1; step <= MECENAT_MAX_CONSECUTIVE_DAYS; step++) {
      const key = dateKey(addDays(day, step));
      if (!isWorked(key, context)) break;
      lastKey = key;
    }
    const length = Math.round((fromKey(lastKey).getTime() - fromKey(firstKey).getTime()) / 86_400_000) + 1;
    if (length > MECENAT_MAX_CONSECUTIVE_DAYS)
      reasons.push(
        `Trop de jours d’affilée : avec ce lundi, vous travailleriez ${length} jours de suite, du ${shortDate(firstKey)} au ${shortDate(lastKey)}. Un lundi n’est possible que si un congé ou une récupération validé coupe la série dans les 6 jours avant ou après, pour ne pas dépasser 6 jours consécutifs.`,
      );
  }
  return reasons;
}
