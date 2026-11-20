/**
 * Où en est la lecture d'un bulletin photographié : la page en cours et son
 * avancement, puis, si la lecture n'a pas pu être prouvée, ce que la photo a
 * de gênant (floue, sombre, coupée). Passager : rien n'est gardé, et l'écran
 * du bulletin le lit directement, sans passer par l'état de l'application.
 */
import { useSyncExternalStore } from "react";

export type PayslipReadStatus = {
  /** La lecture en cours : page lue sur combien, et sa part faite (0 à 1). */
  progress: { page: number; pages: number; ratio: number } | null;
  /** Les conseils pour reprendre une photo mal lue. */
  advice: string[];
};

const IDLE: PayslipReadStatus = { progress: null, advice: [] };
let status = IDLE;
const listeners = new Set<() => void>();

export function setPayslipReadStatus(next: Partial<PayslipReadStatus>) {
  status = { ...status, ...next };
  for (const listener of listeners) listener();
}

export const resetPayslipReadStatus = () => setPayslipReadStatus(IDLE);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePayslipReadStatus() {
  return useSyncExternalStore(subscribe, () => status, () => IDLE);
}
