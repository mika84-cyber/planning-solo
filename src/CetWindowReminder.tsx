import { type CSSProperties, type FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { LeavePeriod, ManualYearAdjustments } from "./appModel";
import {
  CET_WORK_RULES,
  cetBalanceError,
  cetDeclinedYear,
  cetDepositableDays,
  cetDepositEligibility,
  cetDepositsForYear,
  cetDepositWindow,
  rememberCetDeclined,
  withPlannedCetLeave,
  type CetAccount,
  type CetDepositSource,
} from "./cet";
import { computeLeaveStats } from "./leaveStats";
import { fromKey } from "./planningLogic";
import { plannedCetLeaveDays } from "./useLeaveBalances";

type Remaining = Record<CetDepositSource, number>;

/** Jours restants pour alimenter le CET, aujourd'hui compris : 8 le
 *  24 décembre, 1 le 31 ; 47 en novembre (le compte n'est montré qu'en fin de
 *  délai). */
function cetDaysLeft(todayKey: string) {
  return todayKey.slice(5, 7) === "12" ? 32 - Number(todayKey.slice(8)) : 47;
}

/** Ce que dit le rappel de l'accueil, ou `null` s'il n'a rien à dire. */
export type CetReminderState = { daysLeft: number } & (
  | { kind: "setup" }
  | { kind: "missing"; missingDays: number; minimum: number; taken: number }
  | { kind: "open"; total: number; bySource: Remaining }
);

/**
 * Le rappel de l'alimentation du CET, du 15 novembre au 31 décembre. Sans CET
 * suivi (jamais renseigné, ou « Je n'ai pas de CET ») : « Avez-vous un CET ? »,
 * pour indiquer son solde ou demander son ouverture, sauf si « Non » a déjà
 * été répondu cette année (`declinedYear`) : la question revient l'an
 * prochain. Avec un CET : rien une fois l'alimentation de l'année
 * enregistrée ; sinon les CA qui manquent, ou ce qui peut être versé (rien à
 * verser : pas de rappel).
 */
export function cetWindowReminderState({ todayKey, account, annualDaysTaken, remaining, plannedLeaveDays, declinedYear }: {
  todayKey: string;
  account: CetAccount | undefined;
  annualDaysTaken: number;
  remaining: Remaining;
  plannedLeaveDays: number;
  /** L'année où « Non » a été répondu sur cet appareil. */
  declinedYear?: number;
}): CetReminderState | null {
  const window = cetDepositWindow(todayKey);
  if (!window.open) return null;
  const daysLeft = cetDaysLeft(todayKey);
  if (!account?.enabled) return declinedYear === window.year ? null : { kind: "setup", daysLeft };
  if (cetDepositsForYear(account, window.year).length) return null;
  const minimum = CET_WORK_RULES[account.workRule].minimumAnnualDaysTaken;
  const eligibility = cetDepositEligibility(annualDaysTaken, minimum);
  if (!eligibility.eligible) return { kind: "missing", missingDays: eligibility.missingDays, minimum, taken: annualDaysTaken, daysLeft };
  const { bySource, total } = cetDepositableDays(withPlannedCetLeave(account, plannedLeaveDays, todayKey), remaining, window.year);
  return total > 0 ? { kind: "open", total, bySource, daysLeft } : null;
}

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const days = (value: number) => `${number(value)} jour${value > 1 ? "s" : ""}`;
/** L'étiquette de la carte : le délai, pressant la dernière semaine. */
function cetReminderLabel(daysLeft: number) {
  const urgent = daysLeft <= 8;
  return { urgent, label: !urgent ? "CET · jusqu’au 31 décembre" : daysLeft === 1 ? "CET · dernier jour" : `CET · plus que ${daysLeft} jours` };
}

/** Ce qui peut être versé, par origine, dans l'ordre de la barre. */
function cetReminderSources({ annual, rtt, fraction }: Remaining) {
  return ([
    ["annual", annual, "CA"],
    ["rtt", rtt, "RTT"],
    ["fraction", fraction, fraction > 1 ? "jours de fractionnement" : "jour de fractionnement"],
  ] as const).filter(([, value]) => value > 0);
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
  /** Mon CET, pour voir son compte. */
  onOpenCet: () => void;
  /** Mon CET, demande d'ouverture ouverte. */
  onRequestOpening: () => void;
  /** « Poser un congé », pour les CA qui manquent. */
  onRequestLeave: () => void;
  /** Enregistre le compte d'après le solde du relevé RH ; vrai une fois fait. */
  onSaveBalance: (initialBalance: number, legacyCap70: boolean) => Promise<boolean>;
  onNoCet: () => void;
};

const STEPS = ["Votre CET", "Son solde", "Demande"] as const;
const CHECK = <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;

/** La frise du parcours : la question, le solde, la demande. */
function CetJourney({ step }: { step: number }) {
  return (
    <ol className="cet-journey" aria-label="Étapes">
      {STEPS.map((name, index) => {
        const rank = index + 1;
        return (
          <li key={name} className={rank < step ? "done" : rank === step ? "current" : undefined} aria-current={rank === step ? "step" : undefined}>
            <span className="cet-journey-mark" aria-hidden="true">{rank < step ? CHECK : rank}</span>
            <small>{name}{rank < step ? <span className="visually-hidden"> : fait</span> : null}</small>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Le rappel de l'accueil, en parcours guidé : une frise de trois étapes
 * (« Votre CET », « Son solde », « Demande ») et, dans la même carte, l'étape
 * en cours avec un seul geste à faire. « Oui » à la question fait saisir le
 * solde du relevé RH sans quitter l'accueil ; ensuite, ce qui peut être versé,
 * ou les CA qui manquent. « Plus tard », en haut, replie la carte en bandeau.
 */
export function CetWindowReminder({ todayKey, account, periods, group, manualAdjustments, onPrepare, onOpenCet, onRequestOpening, onRequestLeave, onSaveBalance, onNoCet }: Props) {
  const [foldedOn, setFoldedOn] = useState(readFolded);
  // Le bandeau touché redéplie la carte pour la visite, sans oublier le repli.
  const [unfolded, setUnfolded] = useState(false);
  const [askBalance, setAskBalance] = useState(false);
  // « Non » : la carte demande confirmation avant de se taire pour l'année.
  const [confirmNo, setConfirmNo] = useState(false);
  const [declinedYear, setDeclinedYear] = useState(cetDeclinedYear);
  const [balanceInput, setBalanceInput] = useState("");
  const [legacyCap70, setLegacyCap70] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [saving, setSaving] = useState(false);
  // Solde enregistré dans la carte et rien à verser : elle le dit au lieu de
  // disparaître d'un coup.
  const [savedHere, setSavedHere] = useState(false);
  const focusNext = useRef<"ribbon" | "card" | "balance" | null>(null);
  const ribbonRef = useRef<HTMLButtonElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const balanceRef = useRef<HTMLInputElement>(null);
  const folded = !unfolded && cetReminderFolded(foldedOn, todayKey);
  useEffect(() => {
    // Le bouton touché disparaît : la main passe à ce qui le remplace (le
    // bandeau, le geste de l'étape, le champ du solde). Rien d'autre.
    const target = focusNext.current === "ribbon" ? ribbonRef.current : focusNext.current === "balance" ? balanceRef.current : focusNext.current === "card" ? goRef.current : null;
    focusNext.current = null;
    target?.focus();
  });
  const state = useMemo(() => {
    // Les soldes de l'année ne se calculent que si la carte peut s'afficher.
    const year = Number(todayKey.slice(0, 4));
    if (!cetDepositWindow(todayKey).open || (account?.enabled ? cetDepositsForYear(account, year).length : declinedYear === year)) return null;
    const stats = computeLeaveStats({ year: Number(todayKey.slice(0, 4)), today: fromKey(todayKey), periods, group, manualAdjustments });
    const balance = (type: CetDepositSource) => stats.balances.find((item) => item.type === type);
    return cetWindowReminderState({
      todayKey, account,
      annualDaysTaken: balance("annual")?.used || 0,
      remaining: { annual: balance("annual")?.remaining || 0, rtt: balance("rtt")?.remaining || 0, fraction: balance("fraction")?.remaining || 0 },
      plannedLeaveDays: plannedCetLeaveDays(periods, group),
      declinedYear,
    });
  }, [todayKey, account, periods, group, manualAdjustments, declinedYear]);
  if (!state && !savedHere) return null;
  if (state && folded) {
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
  const { urgent, label } = cetReminderLabel(state?.daysLeft ?? cetDaysLeft(todayKey));
  const sources = state?.kind === "open" ? cetReminderSources(state.bySource) : [];
  const kind = !state ? "nothing" : state.kind === "setup" && askBalance ? "balance" : state.kind === "setup" && confirmNo ? "decline" : state.kind;
  const fold = () => {
    try { localStorage.setItem(FOLDED_KEY, todayKey); } catch { /* Replié pour cette visite seulement. */ }
    focusNext.current = "ribbon";
    setFoldedOn(todayKey);
    setUnfolded(false);
  };
  const declineForYear = () => {
    const year = Number(todayKey.slice(0, 4));
    rememberCetDeclined(year);
    setDeclinedYear(year);
    setConfirmNo(false);
    onNoCet();
  };
  const saveBalance = async (event: FormEvent) => {
    event.preventDefault();
    const value = balanceInput.trim() === "" ? Number.NaN : Number(balanceInput);
    const problem = cetBalanceError(value);
    if (problem) {
      setBalanceError(problem);
      balanceRef.current?.focus();
      return;
    }
    setSaving(true);
    const saved = await onSaveBalance(value, value > 60 && legacyCap70);
    setSaving(false);
    if (!saved) return;
    setBalanceError("");
    setAskBalance(false);
    setSavedHere(true);
    focusNext.current = "card";
  };
  return (
    <aside className={`cet-window-reminder ${kind}`} aria-labelledby="cet-window-reminder-title">
      <div className="cet-window-reminder-top">
        <span className={`step-label${urgent ? " urgent" : ""}`}>{label}</span>
        {state
          ? <button type="button" className="cet-window-reminder-later" onClick={fold}>Plus tard</button>
          : <button type="button" className="cet-window-reminder-later" onClick={() => setSavedHere(false)}>Fermer</button>}
      </div>
      <CetJourney step={kind === "setup" || kind === "decline" ? 1 : kind === "balance" ? 2 : 3} />
      {kind === "setup" ? (
        <>
          <h2 id="cet-window-reminder-title">Avez-vous un CET ?</h2>
          <p>Vos CA, RTT et jours de fractionnement non pris peuvent y être versés, en une seule demande par an.</p>
          <div className="cet-window-reminder-answers">
            <button ref={goRef} type="button" className="cet-window-reminder-go" onClick={() => { focusNext.current = "balance"; setAskBalance(true); }}>Oui</button>
            <button type="button" className="cet-window-reminder-no" aria-label="Non, je n’ai pas de CET" onClick={() => { focusNext.current = "card"; setConfirmNo(true); }}>Non</button>
          </div>
          {/* Pour qui n'en a pas encore : un encart à part, sous la question,
              plutôt qu'un petit lien souligné qu'on remarquait à peine. */}
          <div className="cet-window-reminder-open">
            <p><strong>Pas encore de CET ?</strong> Vous pouvez en ouvrir un à tout moment de l’année.</p>
            <button type="button" className="cet-window-reminder-no" onClick={onRequestOpening}>Demander <span>l’ouverture<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></span></button>
          </div>
        </>
      ) : kind === "decline" ? (
        <>
          {/* Ce que fait « Confirmer », avec la date du retour, puis ce qui reste
              possible : « Le rappel se tait jusqu'à l'an prochain » ne disait ni
              quand, ni que l'ouverture reste possible toute l'année. */}
          <h2 id="cet-window-reminder-title">Vous n’avez pas de CET ?</h2>
          <p>Si vous confirmez, ce rappel ne s’affichera plus avant le 15 novembre {Number(todayKey.slice(0, 4)) + 1}.</p>
          <p>Vous pourrez quand même ouvrir un CET à tout moment de l’année, depuis Congés › Mon CET.</p>
          <div className="cet-window-reminder-answers">
            <button ref={goRef} type="button" className="cet-window-reminder-go" onClick={declineForYear}>Confirmer : je n’ai pas de CET</button>
            <button type="button" className="cet-window-reminder-no" onClick={() => { focusNext.current = "card"; setConfirmNo(false); }}>‹ Revenir à la question</button>
          </div>
        </>
      ) : kind === "balance" ? (
        <>
          <h2 id="cet-window-reminder-title">Quel est son solde ?</h2>
          <p id="cet-window-reminder-hint">Le nombre de jours inscrit sur votre dernier relevé RH.</p>
          <form className="cet-window-reminder-balance" noValidate onSubmit={(event) => void saveBalance(event)}>
            <span className="cet-window-reminder-field">
              <input
                ref={balanceRef}
                type="number" inputMode="numeric" min="0" max="200" step="1" placeholder="0"
                aria-label="Solde du CET, en jours" aria-describedby="cet-window-reminder-hint" aria-invalid={balanceError ? true : undefined}
                value={balanceInput}
                onChange={(event) => { setBalanceInput(event.target.value); setBalanceError(""); }}
              />
              <i aria-hidden="true">jours</i>
            </span>
            <button ref={goRef} type="submit" className="cet-window-reminder-go" disabled={saving}>{saving ? "Enregistrement…" : "Valider"}</button>
          </form>
          {Number(balanceInput) > 60 ? (
            <label className="cet-window-reminder-check">
              <input type="checkbox" checked={legacyCap70} onChange={(event) => setLegacyCap70(event.target.checked)} />
              <span>Mon relevé comprend un solde exceptionnel acquis en 2024 au-delà de 60 jours</span>
            </label>
          ) : null}
          {balanceError ? <p className="cet-window-reminder-error" role="alert">{balanceError}</p> : null}
          <button type="button" className="cet-window-reminder-link" onClick={() => { focusNext.current = "card"; setBalanceError(""); setAskBalance(false); }}>‹ Retour</button>
        </>
      ) : state?.kind === "missing" ? (
        <>
          <h2 id="cet-window-reminder-title">Encore {number(state.missingDays)} CA à poser</h2>
          <span className="cet-window-reminder-bar" aria-hidden="true"><i className="taken" style={{ flexGrow: state.taken }} /><i className="missing" style={{ flexGrow: state.missingDays }} /></span>
          <p>{number(state.taken)} CA posé{state.taken > 1 ? "s" : ""} sur les {number(state.minimum)} nécessaires pour verser des jours cette année.</p>
          <button ref={goRef} type="button" className="cet-window-reminder-go" onClick={onRequestLeave}>Poser des congés</button>
        </>
      ) : state?.kind === "open" ? (
        <>
          <h2 id="cet-window-reminder-title">Vous pouvez verser jusqu’à {days(state.total)}</h2>
          <span className="cet-window-reminder-bar" aria-hidden="true">
            {sources.map(([key, value]) => <i key={key} className={key} style={{ flexGrow: value }} />)}
          </span>
          {/* Plus de jours versables que la demande n'en admet : on choisit parmi eux. */}
          <p className="cet-window-reminder-sources">
            <span>{sources.reduce((sum, [, value]) => sum + value, 0) > state.total ? "à prendre parmi" : "soit"}</span>
            {sources.map(([key, value, unit]) => <span key={key} className={key}><strong>{number(value)}</strong> {unit}</span>)}
          </p>
          <button ref={goRef} type="button" className="cet-window-reminder-go" onClick={onPrepare}>Préparer ma demande</button>
          <small>D’après vos soldes. {urgent ? "La demande est à envoyer au plus tard le 31 décembre." : "Ce rappel disparaît dès que l’alimentation est enregistrée dans Mon CET."}</small>
        </>
      ) : (
        <>
          <h2 id="cet-window-reminder-title">Rien à verser cette année</h2>
          <p>Solde enregistré. D’après vos soldes, aucun CA, RTT ni jour de fractionnement ne peut être versé sur votre CET.</p>
          <button ref={goRef} type="button" className="cet-window-reminder-go" onClick={onOpenCet}>Voir mon CET</button>
        </>
      )}
    </aside>
  );
}
