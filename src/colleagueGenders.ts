import { useSyncExternalStore } from "react";

/** Genre des collègues (h ou f), renseigné une fois par l'administratrice
 *  dans les groupes. Il accorde « vous le remplacez » ou « vous la
 *  remplacez » ; sans lui, le prénom sert d'indice. Une copie reste sur
 *  l'appareil pour que les phrases soient justes dès l'ouverture. */
export type ColleagueGender = "h" | "f";
export type ColleagueGenders = Readonly<Record<string, ColleagueGender>>;

const STORAGE_KEY = "planning:colleague-genders-v1";
const listeners = new Set<() => void>();
let genders: ColleagueGenders = readStored();

function readStored(): ColleagueGenders {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function sanitize(value: unknown): ColleagueGenders {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, ColleagueGender] => entry[1] === "h" || entry[1] === "f"));
}

/** Enregistre les genres connus (réponse du serveur, ou choix qui vient
 *  d'être validé) et prévient les écrans qui les affichent. */
export function rememberColleagueGenders(next: unknown, merge = false) {
  const clean = sanitize(next);
  genders = merge ? { ...genders, ...clean } : clean;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(genders));
  } catch {
    // Stockage indisponible : la mémoire de la session suffit.
  }
  for (const listener of listeners) listener();
}

export function colleagueGenders() {
  return genders;
}

function normalized(name: string) {
  return name.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

/** Genre d'un nom saisi : le nom complet d'abord, sinon un prénom qui ne
 *  désigne qu'une seule personne des groupes, ou plusieurs du même genre. */
export function genderOfColleague(name: string): ColleagueGender | undefined {
  const target = normalized(name);
  if (!target) return undefined;
  const entries = Object.entries(genders).map(([member, gender]) => [normalized(member), gender] as const);
  const exact = entries.find(([member]) => member === target);
  if (exact) return exact[1];
  const firstName = target.split(" ")[0];
  const matches = new Set(entries.filter(([member]) => member.split(" ")[0] === firstName).map(([, gender]) => gender));
  return matches.size === 1 ? [...matches][0] : undefined;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Relit les écrans quand les genres changent. */
export function useColleagueGenders() {
  return useSyncExternalStore(subscribe, colleagueGenders, colleagueGenders);
}
