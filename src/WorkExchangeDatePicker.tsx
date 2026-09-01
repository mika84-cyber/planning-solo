import { useState } from "react";
import { MonthCalendar } from "./PlanningView";
import {
  DAY_LABELS,
  MONTHS,
  dateKey,
  fromKey,
  getDayInfo,
  localDate,
  longDate,
} from "./planningLogic";

type Props = {
  value: string;
  ownerGroup: number;
  otherGroup: number;
  ariaLabel: string;
  onChange: (date: string) => void;
};

function initialView(value: string) {
  const source = value ? fromKey(value) : new Date();
  return localDate(source.getFullYear(), source.getMonth(), 1);
}

export function WorkExchangeDatePicker({
  value,
  ownerGroup,
  otherGroup,
  ariaLabel,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => initialView(value));

  function toggle() {
    if (!open && value) setView(initialView(value));
    setOpen((current) => !current);
  }

  function moveMonth(offset: number) {
    setView((current) => localDate(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="work-exchange-cycle-picker">
      <button
        className="work-exchange-date-trigger"
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={toggle}
      >
        <span>{value ? "Date sélectionnée" : "Choisir dans le calendrier"}</span>
        <strong>{value ? longDate(fromKey(value)) : "Aucune date"}</strong>
      </button>

      {open ? (
        <section
          className="work-exchange-cycle-calendar"
          aria-label={`Cycle de travail du groupe ${ownerGroup}`}
        >
          <header>
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mois précédent">‹</button>
            <strong>{MONTHS[view.getMonth()]} {view.getFullYear()}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Mois suivant">›</button>
          </header>
          <div className="work-exchange-cycle-legend" role="group" aria-label={`Légende du groupe ${ownerGroup}`}>
            <span className="work">Travail</span>
            <span className="off">Repos</span>
            <span className="training">Formation</span>
          </div>
          <MonthCalendar
            compact
            year={view.getFullYear()}
            month={view.getMonth()}
            renderDay={(date) => {
              const ownerInfo = getDayInfo(date, ownerGroup);
              const otherInfo = getDayInfo(date, otherGroup);
              const key = dateKey(date);
              const selectable = ownerInfo.kind === "work" && otherInfo.kind === "off";
              const incompatibleWorkDay = ownerInfo.kind === "work" && !selectable;
              return (
                <button
                  type="button"
                  key={key}
                  className={`exchange-cycle-day ${ownerInfo.kind} ${selectable ? "selectable" : incompatibleWorkDay ? "incompatible" : "unavailable"}${key === value ? " selected" : ""}`}
                  data-date={key}
                  disabled={!selectable}
                  aria-label={`${longDate(date)}, groupe ${ownerGroup} : ${DAY_LABELS[ownerInfo.kind]}, groupe ${otherGroup} : ${DAY_LABELS[otherInfo.kind]}${selectable ? ", disponible pour l’échange" : ", indisponible pour l’échange"}`}
                  title={`Groupe ${ownerGroup} : ${DAY_LABELS[ownerInfo.kind]} · Groupe ${otherGroup} : ${DAY_LABELS[otherInfo.kind]}`}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                  {incompatibleWorkDay ? <span className="exchange-cycle-unavailable" aria-hidden="true" /> : null}
                </button>
              );
            }}
          />
          <small>
            Seuls les jours où le groupe {ownerGroup} travaille et où le groupe {otherGroup} est en repos sont sélectionnables.
          </small>
        </section>
      ) : null}
    </div>
  );
}
