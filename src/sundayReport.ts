/** Le report automatique de dimanches, décidé à la lecture d'un bulletin.
 *
 *  Les dimanches que le bulletin d'une paie primée ne paie pas sont reportés
 *  sur la paie primée suivante. Quand le même mois est relu (un bulletin mal
 *  lu la première fois, une seconde page), le report que la lecture
 *  précédente avait provoqué ne compte plus : on repart du nombre entier de
 *  dimanches attendus, et la nouvelle lecture décide seule — report ajusté,
 *  ou retiré si le bulletin les paie bien. */
import { unpaidSundays } from "./planningLogic";

export type SundayReportDecision =
  | { kind: "report"; count: number }
  | { kind: "clear" }
  | { kind: "keep" };

export function sundayReportAfterReading({ expected, reported, paid }: {
  /** Dimanches attendus sur ce mois tel qu'il s'affiche : déjà diminué
   *  de `reported` quand un report en est parti. */
  expected: number;
  /** Le report qu'une lecture précédente de ce même mois avait provoqué. */
  reported: number;
  /** Dimanches que le bulletin paie. */
  paid: number;
}): SundayReportDecision {
  const count = unpaidSundays(expected + reported, paid);
  if (count > 0) return { kind: "report", count };
  return reported > 0 ? { kind: "clear" } : { kind: "keep" };
}
