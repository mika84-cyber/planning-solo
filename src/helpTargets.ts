import { useEffect, useEffectEvent } from "react";

/**
 * Où mène une question de la fenêtre d'aide, à l'intérieur d'une page : un
 * onglet, une sous-page ou un volet. La page change d'abord (App.tsx), puis
 * l'écran visé — souvent chargé à la demande — lit la demande en attente dès
 * qu'il s'affiche, ou l'entend s'il est déjà là. Les lignes de Ma paie s'en
 * servent aussi : « Détail du calcul » s'ouvre sur le calcul de la ligne.
 */
export type HelpTarget =
  | "contacts"
  | "radio-codes"
  | "forms"
  | "work-accident"
  | "expo-folder"
  | "meal-folder"
  | "meal-forms"
  | "meal-contact"
  | "program-space"
  | "program-interexpo"
  | "overtime-mecenat"
  | "cet"
  /** Mon CET, formulaire d'alimentation ouvert (rappel de l'accueil). */
  | "cet-funding"
  | "colleague-share"
  | "colleague-groups"
  | "colleague-settings"
  | "pay-gross" | "pay-contributions" | "pay-meal-vouchers" | "pay-tax" | "pay-navigo";

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

/** Depuis un écran, aller dans une autre rubrique : la coque écoute et y
 *  mène (`useSectionRequest`), puis l'écran visé sert `target`. « meal » est
 *  l'écran Titres repas de Ma paie. */
export type SectionRequest = "pdf" | "meal";
const SECTION_REQUEST_EVENT = "planning:open-section";

export function requestSection(section: SectionRequest, target?: HelpTarget) {
  window.dispatchEvent(new CustomEvent(SECTION_REQUEST_EVENT, { detail: section }));
  // Docs ouvert depuis Titres repas : l'entrée d'historique que la coque vient
  // d'ajouter le dit, pour que la flèche ← y ramène (`returnsToMeal`).
  if (section === "pdf") history.replaceState({ ...(history.state || {}), returnTo: "meal" }, "", location.href);
  if (target) requestHelpTarget(target);
}

/** L'écran de Docs affiché a été ouvert depuis Titres repas : la flèche ←
 *  y revient, comme le bouton Retour du téléphone. */
export function returnsToMeal() {
  return typeof history !== "undefined" && history.state?.returnTo === "meal";
}

export function useSectionRequest(open: (section: SectionRequest) => void) {
  const respond = useEffectEvent(open);
  useEffect(() => {
    const listener = (event: Event) => respond((event as CustomEvent<SectionRequest>).detail);
    window.addEventListener(SECTION_REQUEST_EVENT, listener);
    return () => window.removeEventListener(SECTION_REQUEST_EVENT, listener);
  }, []);
}
