import { type CSSProperties, Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { LeavePeriod, ManualYearAdjustments } from "./appModel";
import {
  CET_WORK_RULES,
  cetDepositableDays,
  cetDepositEligibility,
  cetDepositsForYear,
  cetDepositWindow,
  withPlannedCetLeave,
  type CetAccount,
  type CetDepositSource,
} from "./cet";
import { computeLeaveStats } from "./leaveStats";
import { fromKey } from "./planningLogic";
import { plannedCetLeaveDays } from "./useLeaveBalances";

type Remaining = Record<CetDepositSource, number>;

/** Ce que dit le rappel de l'accueil, ou `null` s'il n'a rien à dire. */
export type CetReminderState = { daysLeft: number } & (
  | { kind: "setup" }
  | { kind: "missing"; missingDays: number; minimum: number; taken: number }
  | { kind: "open"; total: number; bySource: Remaining }
);

/**
 * Le rappel de l'alimentation du CET, du 15 novembre au 31 décembre : rien
 * pour qui a répondu « Je n'ai pas de CET » ni une fois l'alimentation de
 * l'année enregistrée ; « Vous avez un CET ? » tant qu'il n'est pas
 * renseigné ; sinon les CA qui manquent, ou ce qui peut être versé (rien à
 * verser : pas de rappel).
 */
export function cetWindowReminderState({ todayKey, account, annualDaysTaken, remaining, plannedLeaveDays }: {
  todayKey: string;
  account: CetAccount | undefined;
  annualDaysTaken: number;
  remaining: Remaining;
  plannedLeaveDays: number;
}): CetReminderState | null {
  const window = cetDepositWindow(todayKey);
  if (!window.open) return null;
  // Jours restants, aujourd'hui compris : 8 le 24 décembre, 1 le 31.
  const daysLeft = todayKey.slice(5, 7) === "12" ? 32 - Number(todayKey.slice(8)) : 47;
  if (!account) return { kind: "setup", daysLeft };
  if (!account.enabled || cetDepositsForYear(account, window.year).length) return null;
  const minimum = CET_WORK_RULES[account.workRule].minimumAnnualDaysTaken;
  const eligibility = cetDepositEligibility(annualDaysTaken, minimum);
  if (!eligibility.eligible) return { kind: "missing", missingDays: eligibility.missingDays, minimum, taken: annualDaysTaken, daysLeft };
  const { bySource, total } = cetDepositableDays(withPlannedCetLeave(account, plannedLeaveDays, todayKey), remaining, window.year);
  return total > 0 ? { kind: "open", total, bySource, daysLeft } : null;
}

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const days = (value: number) => `${number(value)} jour${value > 1 ? "s" : ""}`;
function list(parts: string[]) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}` : parts[0] || "";
}

/** Le texte de la carte : étiquette, titre, phrase et bouton. */
export function cetReminderCopy(state: CetReminderState) {
  const urgent = state.daysLeft <= 8;
  const label = !urgent ? "CET · jusqu’au 31 décembre" : state.daysLeft === 1 ? "CET · dernier jour" : `CET · plus que ${state.daysLeft} jours`;
  if (state.kind === "setup") return {
    urgent, label, title: "Vous avez un CET ?", button: "Indiquer mon solde",
    text: <>Jusqu’au 31 décembre, vous pouvez y verser vos jours non pris. Indiquez son solde pour savoir combien.</>,
  };
  if (state.kind === "missing") return {
    urgent, label, title: `Il vous manque ${number(state.missingDays)} CA posé${state.missingDays > 1 ? "s" : ""}`, button: "Voir mon CET",
    text: <>Pour verser des jours sur votre CET, il faut avoir posé <strong>{days(state.minimum)} de CA</strong> dans l’année. Vous en avez posé {number(state.taken)}.</>,
  };
  const { annual, rtt, fraction } = state.bySource;
  const sources = list([annual ? `${annual} CA` : "", rtt ? `${rtt} RTT` : "", fraction ? `${days(fraction)} de fractionnement` : ""].filter(Boolean));
  // Plus de jours versables que la demande n'en admet : la personne choisit.
  const split = annual + rtt + fraction > state.total ? `, à prendre parmi ${sources}` : ` : ${sources}`;
  return {
    urgent, label, title: "L’alimentation est ouverte", button: "Préparer ma demande",
    text: <>D’après vos soldes, vous pouvez verser jusqu’à <strong>{days(state.total)}</strong> sur votre CET{split}.</>,
    note: urgent ? "La demande est à envoyer au plus tard le 31 décembre." : "Une seule demande par an. Ce rappel disparaît dès qu’elle est enregistrée dans Mon CET.",
  };
}

/** Les phrases du bandeau qui défile : le délai, ce qui attend, le geste. */
export function cetTickerParts(state: CetReminderState) {
  const delay = state.daysLeft === 1 ? "Dernier jour pour alimenter votre CET"
    : state.daysLeft <= 8 ? `Plus que ${state.daysLeft} jours pour alimenter votre CET`
    : "L’alimentation du CET est ouverte jusqu’au 31 décembre";
  if (state.kind === "setup") return [delay, "Indiquez le solde de votre CET pour savoir combien y verser", "Touchez pour l’indiquer"];
  if (state.kind === "missing") return [delay, `Il vous manque ${number(state.missingDays)} CA posé${state.missingDays > 1 ? "s" : ""} pour y verser des jours`, "Touchez pour voir votre CET"];
  return [delay, `Vous pouvez verser jusqu’à ${days(state.total)}`, "Touchez pour préparer votre demande"];
}

/** Part du délai écoulée, en %, du 15 novembre (2 %) au 31 décembre (100 %). */
export function cetWindowElapsed(todayKey: string) {
  const day = Number(todayKey.slice(8));
  const index = todayKey.slice(5, 7) === "12" ? 16 + day : day - 14;
  return Math.round((Math.min(Math.max(index, 0), 47) / 47) * 100);
}

/**
 * « Plus tard » replie la carte en bandeau, sur cet appareil seulement, et elle
 * le reste les jours suivants : elle ne se redéplie d'elle-même qu'une fois,
 * le 24 décembre, pour la dernière semaine. `foldedOn` est le jour du repli.
 */
export function cetReminderFolded(foldedOn: string, todayKey: string) {
  const year = todayKey.slice(0, 4);
  if (!foldedOn.startsWith(`${year}-`) || foldedOn > todayKey) return false;
  const lastWeek = `${year}-12-24`;
  return foldedOn >= lastWeek || todayKey < lastWeek;
}

const FOLDED_KEY = "planning:cet-reminder-later";
function readFolded() {
  try { return localStorage.getItem(FOLDED_KEY) || ""; } catch { return ""; }
}

type Props = {
  todayKey: string;
  account: CetAccount | undefined;
  periods: LeavePeriod[];
  group: number;
  manualAdjustments: Record<string, ManualYearAdjustments> | undefined;
  /** Mon CET, formulaire d'alimentation ouvert. */
  onPrepare: () => void;
  /** Mon CET, pour indiquer son solde ou voir ce qui manque. */
  onOpenCet: () => void;
  onNoCet: () => void;
};

export function CetWindowReminder({ todayKey, account, periods, group, manualAdjustments, onPrepare, onOpenCet, onNoCet }: Props) {
  const [foldedOn, setFoldedOn] = useState(readFolded);
  // Le bandeau touché redéplie la carte pour la visite, sans oublier le repli.
  const [unfolded, setUnfolded] = useState(false);
  const focusNext = useRef<"ribbon" | "card" | null>(null);
  const ribbonRef = useRef<HTMLButtonElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const folded = !unfolded && cetReminderFolded(foldedOn, todayKey);
  useEffect(() => {
    // Le bouton touché disparaît : la main passe à ce qui le remplace. Rien
    // n'est demandé hors de ces deux gestes.
    const target = focusNext.current === "ribbon" ? ribbonRef.current : focusNext.current === "card" ? goRef.current : null;
    focusNext.current = null;
    target?.focus();
  });
  const state = useMemo(() => {
    // Les soldes de l'année ne se calculent que si la carte peut s'afficher.
    if (!cetDepositWindow(todayKey).open || (account && (!account.enabled || cetDepositsForYear(account, Number(todayKey.slice(0, 4))).length))) return null;
    const stats = computeLeaveStats({ year: Number(todayKey.slice(0, 4)), today: fromKey(todayKey), periods, group, manualAdjustments });
    const balance = (type: CetDepositSource) => stats.balances.find((item) => item.type === type);
    return cetWindowReminderState({
      todayKey, account,
      annualDaysTaken: balance("annual")?.used || 0,
      remaining: { annual: balance("annual")?.remaining || 0, rtt: balance("rtt")?.remaining || 0, fraction: balance("fraction")?.remaining || 0 },
      plannedLeaveDays: plannedCetLeaveDays(periods, group),
    });
  }, [todayKey, account, periods, group, manualAdjustments]);
  if (!state) return null;
  if (folded) {
    // Un flash info : le texte défile en boucle (deux copies à la suite), à
    // vitesse de lecture constante quelle que soit sa longueur. Le nom du
    // bouton reprend les phrases, sans les losanges qui les séparent. Un filet,
    // en bas, avance du 15 novembre au 31 décembre.
    const parts = cetTickerParts(state);
    const line = parts.map((part) => <Fragment key={part}>{part}<i /></Fragment>);
    return (
      <button ref={ribbonRef} type="button" className={`cet-ticker${state.daysLeft <= 8 ? " urgent" : ""}`} aria-label={`${parts.join(". ")}.`} onClick={() => { focusNext.current = "card"; setUnfolded(true); }}>
        <span className="cet-ticker-label" aria-hidden="true">CET</span>
        <span className="cet-ticker-window" aria-hidden="true">
          <span className="cet-ticker-track" style={{ "--ticker-duration": `${Math.round(parts.join(" • ").length * 0.2)}s` } as CSSProperties}>
            <span>{line}</span>
            <span>{line}</span>
          </span>
        </span>
        <span className="cet-ticker-more" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg></span>
        <span className="cet-ticker-gauge" aria-hidden="true" style={{ "--elapsed": `${cetWindowElapsed(todayKey)}%` } as CSSProperties} />
      </button>
    );
  }
  const copy = cetReminderCopy(state);
  const fold = () => {
    try { localStorage.setItem(FOLDED_KEY, todayKey); } catch { /* Replié pour cette visite seulement. */ }
    focusNext.current = "ribbon";
    setFoldedOn(todayKey);
    setUnfolded(false);
  };
  return (
    <aside className="cet-window-reminder" aria-labelledby="cet-window-reminder-title">
      <span className="cet-symbol" aria-hidden="true">CET</span>
      <div className="cet-window-reminder-head">
        <span className={`step-label${copy.urgent ? " urgent" : ""}`}>{copy.label}</span>
        <h2 id="cet-window-reminder-title">{copy.title}</h2>
      </div>
      <div className="cet-window-reminder-text">
        <p>{copy.text}</p>
        {copy.note ? <small>{copy.note}</small> : null}
      </div>
      <div className="cet-window-reminder-actions">
        <button ref={goRef} type="button" className="cet-window-reminder-go" onClick={state.kind === "open" ? onPrepare : onOpenCet}>{copy.button}</button>
        <span className="cet-window-reminder-links">
          {state.kind === "setup" ? <button type="button" className="cet-window-reminder-later" onClick={onNoCet}>Je n’ai pas de CET</button> : null}
          <button type="button" className="cet-window-reminder-later" onClick={fold}>Plus tard</button>
        </span>
      </div>
    </aside>
  );
}
