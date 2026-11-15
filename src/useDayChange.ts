import { type Dispatch, type SetStateAction, useEffect } from "react";
import { dateKey } from "./planningLogic";

/** Le jour affiché, gardé tel quel s'il n'a pas changé (pas de rendu inutile). */
export function followDay(previous: Date, actual: Date) {
  return dateKey(previous) === dateKey(actual) ? previous : actual;
}

/** Délai jusqu'au lendemain 00:00:05, heure de l'appareil. */
export function delayUntilNextDay(from: Date) {
  const next = new Date(from);
  next.setHours(24, 0, 5, 0);
  return next.getTime() - from.getTime();
}

/**
 * L'application restée ouverte d'un jour à l'autre (téléphone en veille,
 * onglet jamais fermé) suit le jour : à minuit et au retour dans
 * l'application, « aujourd'hui » est relu, sans toucher au mois affiché. Le
 * rappel du CET, qui s'ouvre le 15 novembre, apparaît ainsi sans relancer
 * l'application.
 */
export function useDayChange(setNow: Dispatch<SetStateAction<Date>>) {
  useEffect(() => {
    const refresh = () => {
      const actual = new Date();
      setNow((previous) => followDay(previous, actual));
    };
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => { refresh(); schedule(); }, delayUntilNextDay(new Date()));
    };
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [setNow]);
}
