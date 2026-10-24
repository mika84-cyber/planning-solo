import { useState } from "react";
import { ClockTimePicker } from "./ClockTimePicker";
import type { MecenatSignup } from "./mecenat";
import { dateKey, fromKey, s } from "./planningLogic";

/**
 * Les dates auxquelles on s'est inscrit pour un mécénat, avec leurs horaires
 * quand on les connaît, en attente : chacune se retient (la déclaration
 * s'ouvre, date et horaires déjà remplis) ou s'efface. Les dates passées sans
 * suite se signalent.
 */
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function MecenatSignupList({
  signups,
  onAdd,
  onRetain,
  onDelete,
  today = new Date(),
}: {
  signups: MecenatSignup[];
  onAdd: (date: string, start: string, end: string) => void;
  onRetain: (signup: MecenatSignup) => void;
  onDelete: (signup: MecenatSignup) => void;
  today?: Date;
}) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const todayKey = dateKey(today);
  const ordered = [...signups].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="mecenat-signups" role="region" aria-label="Mes dates d’inscription">
      <p className="mecenat-signups-intro">
        Notez les dates où vous vous êtes inscrit, avec les horaires si vous les connaissez. Retenue, une date devient un mécénat à déclarer ; sinon, effacez-la.
      </p>
      <form
        className="mecenat-signups-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          onAdd(date, start, end);
          setDate("");
          setStart("");
          setEnd("");
        }}
      >
        <label>
          <span>Date d’inscription</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <div className="mecenat-signups-hours">
          <ClockTimePicker label="Heure de début" value={start} allowEmpty onChange={setStart} />
          <ClockTimePicker label="Heure de fin" value={end} allowEmpty onChange={setEnd} />
        </div>
        <button type="submit" className="secondary-button" disabled={!date}>Ajouter</button>
      </form>
      {ordered.length ? (
        <ul className="mecenat-signups-list">
          {ordered.map((signup) => {
            const day = fromKey(signup.date);
            const past = signup.date < todayKey;
            return (
              <li key={signup.id} className={past ? "is-past" : undefined}>
                <time dateTime={signup.date}>
                  <b>{capitalized(day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</b>
                  <small>
                    {signup.start && signup.end ? `${signup.start} → ${signup.end} · ` : ""}
                    {past ? "date passée · à retenir ou à effacer" : "en attente"}
                  </small>
                </time>
                <span className="mecenat-signups-actions">
                  <button type="button" className="primary-action" onClick={() => onRetain(signup)} aria-label={`Retenir le ${day.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}>
                    Retenir
                  </button>
                  <button type="button" className="text-button" onClick={() => onDelete(signup)} aria-label={`Effacer le ${day.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}>
                    Effacer
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state">Aucune date d’inscription pour l’instant.</p>
      )}
      {ordered.length ? <p className="mecenat-signups-count">{ordered.length} date{s(ordered.length)} en attente</p> : null}
    </div>
  );
}
