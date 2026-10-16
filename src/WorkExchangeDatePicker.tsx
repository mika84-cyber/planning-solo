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
  /** Groupe qui doit être en repos ; 0 : n'importe quel autre groupe. */
  otherGroup: number;
  ariaLabel: string;
  onChange: (date: string) => void;
  /** Un férié s'échange contre un férié : seuls ceux-là sont proposés. */
  holidaysOnly?: boolean;
  /** Un férié se cède depuis l'onglet « Jour férié » : écarté ici. */
  excludeHolidays?: boolean;
  /** Votre mercredi de formation se cède aussi, contre une formation. */
  allowTraining?: boolean;
  /** Seuls les mercredis de formation du groupe, où l'autre travaille. */
  trainingOnly?: boolean;
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
  holidaysOnly = false,
  excludeHolidays = false,
  allowTraining = false,
  trainingOnly = false,
}: Props) {
  const others = otherGroup ? [otherGroup] : [1, 2, 3].filter((item) => item !== ownerGroup);
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
        <strong>{value ? longDate(fromKey(value)) : "Choisir une date"}</strong>
        <span>{value ? "Changer" : "Calendrier du groupe " + ownerGroup}</span>
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
              const otherKinds = others.map((item) => getDayInfo(date, item).kind);
              const key = dateKey(date);
              // Une formation s'échange contre une formation : ce jour-là,
              // l'autre travaille et prend la place laissée.
              const training = ownerInfo.kind === "training" && otherKinds.includes("work");
              const ordinary = ownerInfo.kind === "work" && otherKinds.includes("off");
              const selectable = (trainingOnly ? training : ordinary || (allowTraining && training))
                && (!holidaysOnly || Boolean(ownerInfo.holiday)) && !(excludeHolidays && ownerInfo.holiday);
              const incompatibleWorkDay = ownerInfo.kind === "work" && !selectable;
              return (
                <button
                  type="button"
                  key={key}
                  className={`exchange-cycle-day ${ownerInfo.kind} ${selectable ? "selectable" : incompatibleWorkDay ? "incompatible" : "unavailable"}${key === value ? " selected" : ""}`}
                  data-date={key}
                  disabled={!selectable}
                  aria-label={`${longDate(date)}, groupe ${ownerGroup} : ${DAY_LABELS[ownerInfo.kind]}${others.map((item) => `, groupe ${item} : ${DAY_LABELS[getDayInfo(date, item).kind]}`).join("")}${selectable ? ", disponible pour l’échange" : ", indisponible pour l’échange"}`}
                  title={`Groupe ${ownerGroup} : ${DAY_LABELS[ownerInfo.kind]}${others.map((item) => ` · Groupe ${item} : ${DAY_LABELS[getDayInfo(date, item).kind]}`).join("")}`}
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
            {otherGroup
              ? trainingOnly
                ? `Seuls les mercredis de formation du groupe ${ownerGroup}, où vous travaillez, sont sélectionnables.`
                : `Seuls les jours où le groupe ${ownerGroup} travaille et où le groupe ${otherGroup} est en repos sont sélectionnables.`
              : `Seuls les jours où vous travaillez et où un autre groupe est en repos sont sélectionnables, ainsi que vos mercredis de formation.`}
            {excludeHolidays ? " Un jour férié se cède depuis l’onglet « Jour férié »." : ""}
          </small>
        </section>
      ) : null}
    </div>
  );
}
