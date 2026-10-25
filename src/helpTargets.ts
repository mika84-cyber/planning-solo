import { useEffect, useEffectEvent } from "react";

/**
 * Où mène une question de la fenêtre d'aide, à l'intérieur d'une page : un
 * onglet, une sous-page ou un volet. La page change d'abord (App.tsx), puis
 * l'écran visé — souvent chargé à la demande — lit la demande en attente dès
 * qu'il s'affiche, ou l'entend s'il est déjà là.
 */
export type HelpTarget =
  | "contacts"
  | "radio-codes"
  | "forms"
  | "work-accident"
  | "expo-folder"
  | "program-space"
  | "program-interexpo"
  | "overtime-mecenat"
  | "cet"
  | "colleague-share";

const HELP_TARGET_EVENT = "planning:help-target";
/** Une demande non servie s'oublie : elle ne doit pas rouvrir un onglet plus
 *  tard, quand la personne a déjà navigué ailleurs. */
const PENDING_LIFETIME_MS = 8_000;
let pending: HelpTarget | null = null;
let pendingSince = 0;

/** Demande d'ouvrir `target` ; l'écran concerné la prend en charge. */
export function requestHelpTarget(target: HelpTarget) {
  pending = target;
  pendingSince = Date.now();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(HELP_TARGET_EVENT, { detail: target }));
}

/** La demande en attente, sans la retirer. */
export function pendingHelpTarget() {
  if (pending && Date.now() - pendingSince > PENDING_LIFETIME_MS) pending = null;
  return pending;
}

/** Retire la demande une fois servie. */
export function clearHelpTarget(target: HelpTarget) {
  if (pending === target) pending = null;
}

/**
 * Un écran répond aux demandes qui le concernent : `handle` reçoit la demande
 * et dit s'il l'a servie (elle est alors retirée). Un parent qui ne fait
 * qu'ouvrir le bon onglet répond `false` pour laisser l'enfant la servir.
 */
export function useHelpTarget(handle: (target: HelpTarget) => boolean) {
  const respond = useEffectEvent((target: HelpTarget | null) => {
    if (target && handle(target)) clearHelpTarget(target);
  });
  useEffect(() => {
    respond(pendingHelpTarget());
    const listener = (event: Event) => respond((event as CustomEvent<HelpTarget>).detail);
    window.addEventListener(HELP_TARGET_EVENT, listener);
    return () => window.removeEventListener(HELP_TARGET_EVENT, listener);
  }, []);
}
