import type { ReactNode } from "react";
import { euros } from "./appModel";
import type { PayslipGapChoice } from "./payslipGapChoices";
import {
  isPayslipGapExplained,
  payslipGapHeadline,
  type PayslipGapExplanation,
  type PayslipGapLine,
} from "./payslipGapExplanation";
import "./payslipGap.css";

/** « − 24,07 € », « + 2,82 € ». */
export const signedEuros = (amount: number) => `${amount < 0 ? "−" : "+"} ${euros(Math.abs(amount))}`;

const ICON_CHECK = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const ICON_LETTER = <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;

/**
 * Le résultat de la vérification d'un bulletin : ce qui manque (ou est en
 * plus) sur le net, le prévu face au payé, puis d'où vient l'écart, ligne à
 * ligne jusqu'au net. Seul ce qui diffère est dit : les lignes identiques ne
 * sont pas listées. Deux choix pour finir : l'écart est normal et la paie du
 * mois se corrige, ou c'est une erreur et un courrier part à la hiérarchie.
 */
export function PayslipGapResult({
  explanation,
  monthLabel,
  choicesFor,
  onRunChoice,
  notices,
  acceptDetail,
  onAccept,
  onWriteLetter,
}: {
  explanation: PayslipGapExplanation;
  /** « octobre 2026 » */
  monthLabel: string;
  choicesFor: (line: PayslipGapLine) => PayslipGapChoice[];
  onRunChoice: (choice: PayslipGapChoice) => void;
  /** Ce que le bulletin apprend d'autre (lignes inconnues, paiements en
   *  avance), juste avant de conclure. */
  notices?: ReactNode;
  acceptDetail: string;
  onAccept: () => void;
  onWriteLetter: () => void;
}) {
  const { lines, gap } = explanation;
  const net = explanation.level === "net";
  const expected = net ? explanation.expected.net : explanation.expected.gross;
  const actual = net ? explanation.actual.net : explanation.actual.gross;
  const explained = isPayslipGapExplained(explanation);
  const hasGap = !explanation.matches;
  let causeNumber = 0;
  return (
    <section className="payslip-gap-result" aria-label="Résultat de la vérification">
      <header>
        <span className="payslip-gap-kicker">Bulletin lu · {monthLabel}</span>
        <h4>{payslipGapHeadline(explanation)}</h4>
      </header>
      {hasGap && expected !== undefined && actual !== undefined ? (
        <dl className="payslip-gap-trio">
          <div><dt>{net ? "Prévu" : "Brut prévu"}</dt><dd>{euros(expected)}</dd></div>
          <div><dt>{net ? "Payé" : "Brut lu"}</dt><dd>{euros(actual)}</dd></div>
          <div className={`gap${gap > 0 ? " plus" : ""}`}><dt>Écart</dt><dd>{signedEuros(gap)}</dd></div>
        </dl>
      ) : null}
      {lines.length ? (
        <section className={`payslip-gap-why${explained ? "" : " unexplained"}`} aria-label="D’où vient l’écart">
          <span className="payslip-gap-kicker">D’où vient l’écart</span>
          <ol>
            {lines.map((line) => {
              const choices = choicesFor(line);
              if (line.kind === "cause") causeNumber += 1;
              return (
                <li key={line.key} className={line.kind}>
                  <i aria-hidden="true">{line.kind === "follow" ? "↳" : line.kind === "unknown" ? "?" : causeNumber}</i>
                  <span>
                    <strong>{line.title}</strong>
                    <small>
                      {line.detail}
                      {line.applied ? <em className="payslip-gap-applied">{line.applied}</em> : null}
                      {choices.map((choice) => (
                        <button type="button" key={choice.id} className="payslip-gap-link" onClick={() => onRunChoice(choice)}>
                          {choice.label}
                        </button>
                      ))}
                    </small>
                  </span>
                  <b className={line.amount < 0 ? "minus" : "plus"}>{signedEuros(line.amount)}</b>
                </li>
              );
            })}
          </ol>
          <p className="payslip-gap-total"><span>{explained ? "Écart expliqué" : "Écart total"}</span><b>{signedEuros(gap)}</b></p>
          {explained ? (
            <p className="payslip-gap-verdict ok">Tout l’écart est expliqué</p>
          ) : (
            <p className="payslip-gap-verdict warn">
              Une partie de l’écart reste sans explication : mieux vaut écrire à votre hiérarchie.
            </p>
          )}
        </section>
      ) : null}
      {notices}
      <PayslipDecisionOptions hasGap={hasGap} recommendLetter={!explained} acceptDetail={acceptDetail} onAccept={onAccept} onWriteLetter={onWriteLetter} />
    </section>
  );
}

/** Les deux façons de conclure : l'écart est normal, ou c'est une erreur à
 *  signaler par courrier. */
export function PayslipDecisionOptions({
  hasGap,
  recommendLetter = false,
  acceptDetail,
  onAccept,
  onWriteLetter,
}: {
  hasGap: boolean;
  /** Un écart que rien n'explique : le courrier vient en premier. */
  recommendLetter?: boolean;
  acceptDetail: string;
  onAccept: () => void;
  onWriteLetter: () => void;
}) {
  const acceptButton = (
    <button type="button" className="payslip-gap-option accept" onClick={onAccept}>
      <span className="payslip-gap-option-icon">{ICON_CHECK}</span>
      <span>
        <strong>{hasGap ? "C’est normal : corriger ma paie" : "Tout est juste : valider"}</strong>
        <small>{acceptDetail}</small>
      </span>
      <em aria-hidden="true">›</em>
    </button>
  );
  const letterButton = (
    <button type="button" className="payslip-gap-option letter" onClick={onWriteLetter}>
      <span className="payslip-gap-option-icon">{ICON_LETTER}</span>
      <span>
        <strong>{hasGap ? "C’est une erreur : proposition de courrier à envoyer aux RH" : "Signaler une anomalie : proposition de courrier à envoyer aux RH"}</strong>
        <small>{hasGap ? "Un courrier daté qui explique l’écart et demande la régularisation." : "Un courrier daté, avec votre message, pour signaler ce qui ne va pas."}</small>
      </span>
      <em aria-hidden="true">›</em>
    </button>
  );
  return (
    <section className={`payslip-gap-options${recommendLetter ? " letter-first" : ""}`} aria-label="Que voulez-vous faire ?">
      <span className="payslip-gap-kicker">Que voulez-vous faire ?</span>
      {recommendLetter ? <>{letterButton}{acceptButton}</> : <>{acceptButton}{letterButton}</>}
    </section>
  );
}
