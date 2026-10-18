import type { UsefulRadioCode } from "../../src/usefulContactsTypes.ts";

/** Codes d'urgence à la radio : envoyés avec l'annuaire, donc seulement aux
 *  comptes connectés, jamais inscrits dans le code public de l'application.
 *  Les majuscules reprennent l'affiche : la lettre du code (F de FOX…). */
export const USEFUL_RADIO_CODES: UsefulRadioCode[] = [
  { code: "FOX", meaning: "Alerte Feu" },
  { code: "TANGO", meaning: "Attaque Terroriste" },
  { code: "VICTOR", meaning: "Vol ou dégradation d’œuvre" },
  { code: "BRAVO", meaning: "Alerte à la Bombe" },
  { code: "CHARLIE", meaning: "Colis abandonné" },
  { code: "MIKE", meaning: "Mouvement d’œuvre" },
  { code: "EXGO", meaning: "Coupure majeure d’électricité" },
  { code: "CODE 22", meaning: "Individu au comportement suspect" },
  { code: "CODE 17", meaning: "Altercation avec un individu menaçant" },
  { code: "SIERRA", meaning: "Risque d’atteinte à la Structure du bâtiment" },
];
