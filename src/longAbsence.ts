/** Absences de 31 jours consécutifs et plus : la note « Demande de congé »
 *  les interdit sauf dérogation exceptionnelle. L'application les repère et
 *  prépare un courrier de demande à la cheffe de service.
 *
 *  Une absence court du premier au dernier jour posé ; les repos et fériés
 *  qui séparent deux congés n'interrompent pas l'absence. La maladie, la
 *  grève et l'accident du travail n'en font pas partie. */
import { addDays, dateKey, fromKey, getDayInfo } from "./planningLogic";

export const LONG_ABSENCE_DAYS = 31;

const ABSENCE_TYPES = ["annual", "rtt", "fraction", "cet", "recovery", "other", "childcare", "exceptional"] as const;
type AbsenceType = (typeof ABSENCE_TYPES)[number];

export type AbsencePeriod = { from: string; to: string; leaveType?: string; group?: number };
export type LongAbsence = { from: string; to: string; days: number; byType: Partial<Record<AbsenceType, number>> };

function isAbsence(type: string | undefined): type is AbsenceType {
  return (ABSENCE_TYPES as readonly string[]).includes(type ?? "");
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

/** Brouillon du courrier de demande à la cheffe de service, à compléter du
 *  motif. */
export function longAbsenceLetter(absence: LongAbsence, sender: { fullName: string }, today: Date) {
  const name = sender.fullName.trim() || "[Nom prénom]";
  return [
    name,
    "DPU - SAP",
    "",
    "À l’attention de Madame Laurence Nida,",
    "Cheffe de service de l’accueil des publics.",
    "",
    "Objet : Demande de congés supérieurs à 31 jours consécutifs.",
    "",
    "Madame Nida,",
    "",
    `Je me permets de vous adresser ce message afin de solliciter un congé d’une durée supérieure à 31 jours, pour la période du ${absenceDateLabel(absence.from)} au ${absenceDateLabel(absence.to)} inclus.`,
    "",
    "Cette demande est motivée par [indiquer brièvement la raison si nécessaire].",
    "",
    "Je vous remercie par avance pour l’attention portée à ma demande et reste à votre disposition pour toute information complémentaire.",
    "",
    "Dans l’attente de votre retour, je vous prie d’agréer, Madame Nida, l’expression de mes salutations distinguées.",
    "",
    "",
    name,
    `Le ${absenceDateLabel(dateKey(today))}`,
  ].join("\n");
}
