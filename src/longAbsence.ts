/** Absences de 31 jours consécutifs et plus : la note « Demande de congé »
 *  les interdit sauf dérogation exceptionnelle. L'application les repère et
 *  prépare un courrier de demande à la cheffe de service.
 *
 *  Une absence court du premier au dernier jour posé ; les repos et fériés
 *  qui séparent deux congés n'interrompent pas l'absence. La maladie, la
 *  grève et l'accident du travail n'en font pas partie. */
import { addDays, dateKey, fromKey, getDayInfo } from "./planningLogic";

export const LONG_ABSENCE_DAYS = 31;

const ABSENCE_LABELS = {
  annual: ["jour de congés annuels", "jours de congés annuels"],
  rtt: ["RTT", "RTT"],
  fraction: ["jour de fractionnement", "jours de fractionnement"],
  cet: ["jour de CET", "jours de CET"],
  recovery: ["jour de récupération", "jours de récupération"],
  other: ["jour divers", "jours divers"],
  childcare: ["jour de garde d’enfant", "jours de garde d’enfant"],
  exceptional: ["jour d’absence exceptionnelle", "jours d’absence exceptionnelle"],
} as const;
type AbsenceType = keyof typeof ABSENCE_LABELS;

export type AbsencePeriod = { from: string; to: string; leaveType?: string; group?: number };
export type LongAbsence = { from: string; to: string; days: number; byType: Partial<Record<AbsenceType, number>> };

function isAbsence(type: string | undefined): type is AbsenceType {
  return typeof type === "string" && Object.hasOwn(ABSENCE_LABELS, type);
}

function daysBetween(from: string, to: string) {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86_400_000) + 1;
}

/** Absences d'au moins 31 jours consécutifs qui ne sont pas terminées. */
export function longAbsences(periods: readonly AbsencePeriod[], group: number, todayKey: string): LongAbsence[] {
  const typeOf = new Map<string, AbsenceType>();
  for (const period of periods) {
    if (!isAbsence(period.leaveType) || !period.from || !period.to) continue;
    for (let date = fromKey(period.from); dateKey(date) <= period.to; date = addDays(date, 1)) {
      const key = dateKey(date);
      if (!typeOf.has(key)) typeOf.set(key, period.leaveType);
    }
  }
  const dates = [...typeOf.keys()].sort();
  const worked = (key: string) => {
    const info = getDayInfo(fromKey(key), group);
    return !info.holiday && info.kind !== "off";
  };
  const runs: Array<{ from: string; to: string }> = [];
  for (const key of dates) {
    const run = runs.at(-1);
    if (run) {
      let bridged = true;
      for (let date = addDays(fromKey(run.to), 1); dateKey(date) < key; date = addDays(date, 1)) {
        if (worked(dateKey(date))) {
          bridged = false;
          break;
        }
      }
      if (bridged) {
        run.to = key;
        continue;
      }
    }
    runs.push({ from: key, to: key });
  }
  return runs
    .map((run) => {
      const byType: LongAbsence["byType"] = {};
      for (let date = fromKey(run.from); dateKey(date) <= run.to; date = addDays(date, 1)) {
        const key = dateKey(date);
        const type = typeOf.get(key);
        if (type && worked(key)) byType[type] = (byType[type] || 0) + 1;
      }
      return { ...run, days: daysBetween(run.from, run.to), byType };
    })
    .filter((run) => run.days >= LONG_ABSENCE_DAYS && run.to >= todayKey);
}

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** « 1er juillet », jamais « 1 juillet ». */
export function absenceDateLabel(key: string, long = false) {
  return (long ? longDateFormatter : shortDateFormatter).format(fromKey(key)).replace(/(?<!\d)1 (?=\p{L})/u, "1er ");
}

function breakdown(byType: LongAbsence["byType"]) {
  const parts = (Object.keys(ABSENCE_LABELS) as AbsenceType[])
    .filter((type) => byType[type])
    .map((type) => {
      const count = byType[type] || 0;
      return `${count} ${ABSENCE_LABELS[type][count > 1 ? 1 : 0]}`;
    });
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}

/** Brouillon du courrier de demande de dérogation, à compléter du motif. */
export function longAbsenceLetter(absence: LongAbsence, sender: { fullName: string; job: string; group: number }, today: Date) {
  const name = sender.fullName.trim() || "[Votre nom et prénom]";
  const detail = breakdown(absence.byType);
  return [
    name,
    `${sender.job} — groupe ${sender.group}`,
    "",
    "À l’attention de Madame la cheffe de service",
    "",
    "Objet : demande de dérogation pour une absence de plus de 31 jours consécutifs",
    "",
    "Madame,",
    "",
    `Je souhaite m’absenter du ${absenceDateLabel(absence.from, true)} au ${absenceDateLabel(absence.to, true)}, soit ${absence.days} jours consécutifs${detail ? `, en posant ${detail}` : ""}.`,
    "",
    "La note de service limitant les absences à 31 jours consécutifs, sauf dérogation exceptionnelle, je vous remercie de bien vouloir m’accorder cette dérogation.",
    "",
    "[Précisez ici le motif de votre demande.]",
    "",
    "Je reste à votre disposition pour organiser la continuité du service pendant mon absence.",
    "",
    "Je vous prie d’agréer, Madame, l’expression de mes salutations respectueuses.",
    "",
    name,
    `Le ${absenceDateLabel(dateKey(today))}`,
  ].join("\n");
}
