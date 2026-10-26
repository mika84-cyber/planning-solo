import type { CSSProperties } from "react";
import { ClockTimePicker } from "./ClockTimePicker";
import type { LeaveHours, LeaveMoment } from "./planningLogic";

/**
 * Journée, Matin ou Après-midi pour les dates touchées ensuite et, pour une
 * moitié de journée, les heures posées. Le même sélecteur sert dans le
 * panneau de la demande et juste au-dessus du planning, là où l'on touche
 * les dates : une journée entière et une demi-journée se posent dans la même
 * demande sans aller chercher le réglage plus loin.
 */
export function LeaveDurationControl({
  moment,
  hours,
  color,
  label = "Durée",
  ariaLabel = "Durée du congé",
  onSelectMoment,
  onChangeHours,
}: {
  moment: LeaveMoment;
  hours: LeaveHours;
  color: string;
  label?: string;
  ariaLabel?: string;
  onSelectMoment: (moment: LeaveMoment) => void;
  onChangeHours?: (hours: LeaveHours) => void;
}) {
  return (
    <div className="leave-moment-tabs" role="group" aria-label={ariaLabel} style={{ "--type-color": color } as CSSProperties}>
      <span className="leave-moment-label" aria-hidden="true">{label}</span>
      {([["full", "Journée"], ["morning", "Matin"], ["afternoon", "Après-midi"]] as const).map(([value, text]) => (
        <button type="button" key={value} className={moment === value ? "active" : undefined} aria-pressed={moment === value} onClick={() => onSelectMoment(value)}>
          {text}
        </button>
      ))}
      {moment !== "full" && onChangeHours ? (
        <div className="leave-moment-hours" role="group" aria-label={moment === "morning" ? "Heures posées le matin" : "Heures posées l’après-midi"}>
          <ClockTimePicker label="Début" value={hours.start} onChange={(start) => onChangeHours({ ...hours, start })} allowEmpty />
          <ClockTimePicker label="Fin" value={hours.end} onChange={(end) => onChangeHours({ ...hours, end })} allowEmpty />
          {hours.start && hours.end && hours.end <= hours.start ? (
            <small role="alert">L’heure de fin doit suivre l’heure de début.</small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
