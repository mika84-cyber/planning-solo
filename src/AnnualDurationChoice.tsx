import { useState } from "react";
import { ClockTimePicker } from "./ClockTimePicker";
import type { HalfMoment, LeaveHours, LeaveMoment } from "./planningLogic";
import { validLeaveHours } from "./useRequestTypeSelection";

/**
 * La ligne CA de « Que voulez-vous poser ? » : le congé d'un toucher, et sa
 * durée juste dessous. Le matin ou l'après-midi demande d'abord les heures,
 * ici même, avant de choisir les dates ; les habituelles sont proposées
 * quand le profil les connaît.
 */
export function AnnualDurationChoice({
  hint,
  usualHalfHours,
  onChoose,
}: {
  /** Ce qu'il reste de congés annuels. */
  hint: string;
  usualHalfHours?: (moment: HalfMoment) => LeaveHours;
  onChoose: (moment: LeaveMoment, hours?: LeaveHours) => void;
}) {
  const [step, setStep] = useState<{ moment: HalfMoment; hours: LeaveHours } | null>(null);
  const begin = (moment: HalfMoment) => setStep({ moment, hours: usualHalfHours?.(moment) ?? { start: "", end: "" } });
  const setHours = (hours: LeaveHours) => setStep((current) => (current ? { ...current, hours } : current));
  return (
    <>
      <button type="button" className="request-choice-row leave-choice-annual" onClick={() => onChoose("full")}>
        <i aria-hidden="true" /><strong>CA</strong><span>{hint}</span>
      </button>
      {step ? (
        <div className="request-choice-hours leave-choice-annual" role="group" aria-label={step.moment === "morning" ? "Heures du CA le matin" : "Heures du CA l’après-midi"}>
          <p>{step.moment === "morning" ? "Le matin, de quelle heure à quelle heure ?" : "L’après-midi, de quelle heure à quelle heure ?"}</p>
          <div className="request-choice-hours-fields">
            <ClockTimePicker label="Début" value={step.hours.start} onChange={(start) => setHours({ ...step.hours, start })} allowEmpty />
            <ClockTimePicker label="Fin" value={step.hours.end} onChange={(end) => setHours({ ...step.hours, end })} allowEmpty />
          </div>
          {step.hours.start && step.hours.end && !validLeaveHours(step.hours) ? (
            <small role="alert">L’heure de fin doit suivre l’heure de début.</small>
          ) : null}
          <div className="request-choice-hours-actions">
            <button type="button" className="primary" disabled={!validLeaveHours(step.hours)} onClick={() => onChoose(step.moment, step.hours)}>
              Choisir les dates
            </button>
            <button type="button" onClick={() => setStep(null)}>Retour</button>
          </div>
        </div>
      ) : (
        <div className="request-choice-moments leave-choice-annual" role="group" aria-label="Durée du CA">
          <button type="button" onClick={() => onChoose("full")}>Journée</button>
          <button type="button" onClick={() => begin("morning")}>Matin</button>
          <button type="button" onClick={() => begin("afternoon")}>Après-midi</button>
        </div>
      )}
    </>
  );
}
