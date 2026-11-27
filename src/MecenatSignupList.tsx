import { useState } from "react";
import { ClockTimePicker } from "./ClockTimePicker";
import type { MecenatSignup } from "./mecenat";
import { dateKey, fromKey, getDayInfo, localDate, s } from "./planningLogic";

/**
 * Les dates auxquelles on s'est inscrit pour un mécénat, avec leurs horaires
 * quand on les connaît, en attente : chacune se retient (la déclaration
 * s'ouvre, date et horaires déjà remplis), se modifie ou s'efface. Les dates
 * passées sans suite se signalent.
 */
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const WEEKDAYS: Array<[string, string]> = [
  ["mon", "L"],
  ["tue", "M"],
  ["wed", "M"],
  ["thu", "J"],
  ["fri", "V"],
  ["sat", "S"],
  ["sun", "D"],
];

function buildMonthCells(year: number, month: number): Array<{ key: string; date: Date | null }> {
  const first = localDate(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const totalDays = localDate(year, month + 1, 0).getDate();
  const cells: Array<{ key: string; date: Date | null }> = Array.from({ length: leading }, (_, i) => ({
    key: `empty-${year}-${month}-${i}`,
    date: null,
  }));
  for (let day = 1; day <= totalDays; day += 1) {
    const date = localDate(year, month, day);
    cells.push({ key: dateKey(date), date });
  }
  return cells;
}

function shortDateLabel(key: string) {
  return capitalized(fromKey(key).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }));
}

function MiniDateCalendar({
  value,
  onChange,
  group,
  today,
  markedDates,
  ariaLabel = "Choisir une date d’inscription",
}: {
  value: string;
  onChange: (date: string) => void;
  group?: number;
  today: Date;
  markedDates: Set<string>;
  ariaLabel?: string;
}) {
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromKey(value) : today;
  const [view, setView] = useState(() => localDate(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const todayKey = dateKey(today);
  const cells = buildMonthCells(view.getFullYear(), view.getMonth());
  const monthHeading = capitalized(view.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));

  return (
    <div className="mecenat-mini-cal" role="group" aria-label={ariaLabel}>
      <div className="mecenat-mini-cal-head">
        <button
          type="button"
          className="mecenat-mini-cal-step"
          aria-label="Mois précédent"
          onClick={() => setView((current) => localDate(current.getFullYear(), current.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <strong>{monthHeading}</strong>
        <button
          type="button"
          className="mecenat-mini-cal-step"
          aria-label="Mois suivant"
          onClick={() => setView((current) => localDate(current.getFullYear(), current.getMonth() + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="mecenat-mini-cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map(([id, day]) => <span key={id}>{day}</span>)}
      </div>
      <div className="mecenat-mini-cal-days">
        {cells.map((slot) => {
          if (!slot.date) return <span className="mecenat-mini-cal-empty" key={slot.key} aria-hidden="true" />;
          const cell = slot.date;
          const key = slot.key;
          const kind = group !== undefined ? getDayInfo(cell, group).kind : "work";
          const selected = key === value;
          const isToday = key === todayKey;
          const marked = markedDates.has(key);
          const label = capitalized(cell.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
          return (
            <button
              type="button"
              key={key}
              className={`mecenat-mini-cal-day ${kind}${selected ? " sel" : ""}${isToday ? " today" : ""}${marked && !selected ? " marked" : ""}`}
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onChange(selected ? "" : key)}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MecenatSignupList({
  signups,
  group,
  onAdd,
  onUpdate,
  onRetain,
  onDelete,
  today = new Date(),
}: {
  signups: MecenatSignup[];
  group?: number;
  onAdd: (date: string, start: string, end: string) => void;
  onUpdate?: (signup: MecenatSignup, date: string, start: string, end: string) => void;
  onRetain: (signup: MecenatSignup) => void;
  onDelete: (signup: MecenatSignup) => void;
  today?: Date;
}) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const todayKey = dateKey(today);
  const ordered = [...signups].sort((a, b) => a.date.localeCompare(b.date));
  const markedDates = new Set(signups.map((item) => item.date));

  const startEdit = (signup: MecenatSignup) => {
    setEditingId(signup.id);
    setEditDate(signup.date);
    setEditStart(signup.start);
    setEditEnd(signup.end);
  };

  return (
    <div className="mecenat-signups" role="region" aria-label="Mes dates d’inscription">
      <p className="mecenat-signups-intro">
        Touchez une date dans le calendrier et ajoutez les horaires si vous les connaissez. Retenue, une date devient un mécénat à déclarer ; vous pouvez aussi la modifier ou l’effacer.
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
        <MiniDateCalendar
          value={date}
          onChange={setDate}
          group={group}
          today={today}
          markedDates={markedDates}
          ariaLabel="Calendrier des dates d’inscription"
        />
        <div className="mecenat-signups-hours">
          <ClockTimePicker label="Heure de début" value={start} allowEmpty onChange={setStart} />
          <ClockTimePicker label="Heure de fin" value={end} allowEmpty onChange={setEnd} />
        </div>
        <button type="submit" className="secondary-button mecenat-signups-submit" disabled={!date}>
          {date ? `Ajouter · ${shortDateLabel(date)}` : "Choisissez une date"}
        </button>
      </form>
      {ordered.length ? (
        <ul className="mecenat-signups-list">
          {ordered.map((signup) => {
            const day = fromKey(signup.date);
            const dayShort = day.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
            const past = signup.date < todayKey;
            const editing = editingId === signup.id;
            return (
              <li key={signup.id} className={`${past ? "is-past" : ""}${editing ? " is-editing" : ""}`.trim() || undefined}>
                {editing ? (
                  <form
                    className="mecenat-signup-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) return;
                      onUpdate?.(signup, editDate, editStart, editEnd);
                      setEditingId(null);
                    }}
                  >
                    <MiniDateCalendar
                      key={signup.id}
                      value={editDate}
                      onChange={(next) => next && setEditDate(next)}
                      group={group}
                      today={today}
                      markedDates={new Set(signups.filter((item) => item.id !== signup.id).map((item) => item.date))}
                      ariaLabel="Modifier la date d’inscription"
                    />
                    <div className="mecenat-signups-hours">
                      <ClockTimePicker label="Heure de début" value={editStart} allowEmpty onChange={setEditStart} />
                      <ClockTimePicker label="Heure de fin" value={editEnd} allowEmpty onChange={setEditEnd} />
                    </div>
                    <div className="mecenat-signup-edit-actions">
                      <button type="submit" className="primary-action" disabled={!editDate}>Enregistrer</button>
                      <button type="button" className="text-button" onClick={() => setEditingId(null)}>Annuler</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <time dateTime={signup.date}>
                      <b>{capitalized(day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</b>
                      <small>
                        {signup.start && signup.end ? `${signup.start} → ${signup.end} · ` : ""}
                        {past ? "date passée · à retenir ou à effacer" : "en attente"}
                      </small>
                    </time>
                    <span className="mecenat-signups-actions">
                      <button type="button" className="primary-action" onClick={() => onRetain(signup)} aria-label={`Retenir le ${dayShort}`}>
                        Retenir
                      </button>
                      {onUpdate ? (
                        <button type="button" className="secondary-button mecenat-signup-edit-btn" onClick={() => startEdit(signup)} aria-label={`Modifier le ${dayShort}`}>
                          Modifier
                        </button>
                      ) : null}
                      <button type="button" className="text-button" onClick={() => onDelete(signup)} aria-label={`Effacer le ${dayShort}`}>
                        Effacer
                      </button>
                    </span>
                  </>
                )}
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
