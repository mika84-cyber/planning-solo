import { useState } from "react";
import type { SchoolVacation, SchoolZone } from "./planningLogic";
import { SCHOOL_ZONE_OPTIONS, dateKey, fromKey, schoolVacationsForZone } from "./planningLogic";
import schoolVacationStyles from "./schoolVacations.css?inline";

if (typeof document !== "undefined" && !document.getElementById("school-vacation-styles")) {
  const style = document.createElement("style");
  style.id = "school-vacation-styles";
  style.textContent = schoolVacationStyles;
  document.head.append(style);
}

export function SchoolVacationSettings({
  visible,
  zone,
  onVisibleChange,
  onZoneChange,
  today = new Date(),
}: {
  visible: boolean;
  zone: SchoolZone;
  onVisibleChange: (visible: boolean) => void;
  onZoneChange: (zone: SchoolZone) => void;
  /** Le jour de référence de la prochaine période ; les tests le fixent. */
  today?: Date;
}) {
  /* Un réglage rare, sur une seule ligne : le nom et la zone à gauche (un
     appui déroule les zones), l'interrupteur à droite ; dessous, la période
     en cours ou la prochaine de la zone (depuis le 9 novembre 2026). */
  const [zonesOpen, setZonesOpen] = useState(false);
  const zoneLabel = SCHOOL_ZONE_OPTIONS.find((option) => option.value === zone)?.label ?? "";
  const next = nextSchoolVacation(zone, today);
  return (
    <section className="school-vacation-settings" aria-label="Vacances scolaires">
      <div className="school-vacation-row">
        <button
          className="school-vacation-zone"
          type="button"
          aria-expanded={zonesOpen}
          aria-label={`Vacances scolaires, ${zoneLabel} : choisir la zone`}
          onClick={() => setZonesOpen((open) => !open)}
        >
          <strong>Vacances scolaires</strong>
          <small>· {zoneLabel}</small>
        </button>
        <button
          className={`school-vacation-switch${visible ? " active" : ""}`}
          type="button"
          role="switch"
          aria-checked={visible}
          aria-label="Vacances scolaires affichées dans le planning"
          onClick={() => onVisibleChange(!visible)}
        >
          <span aria-hidden="true"><i /></span>
        </button>
      </div>
      {next ? (
        <small className="school-vacation-next">
          {next.ongoing ? "En cours" : "Prochaines"} : {vacationShortName(next.name)} · {shortDate(next.from)} – {shortDate(next.to)}
        </small>
      ) : null}
      {zonesOpen ? (
        <SchoolZonePicker zone={zone} onPick={(chosen) => { onZoneChange(chosen); setZonesOpen(false); }} />
      ) : null}
    </section>
  );
}

/** Les zones déroulées sous la ligne, la zone affichée enfoncée. */
export function SchoolZonePicker({ zone, onPick }: { zone: SchoolZone; onPick: (zone: SchoolZone) => void }) {
  return (
    <div className="school-zone-picker" role="group" aria-label="Zone scolaire affichée">
      {SCHOOL_ZONE_OPTIONS.map((option) => (
        <button
          type="button"
          key={option.value}
          className={zone === option.value ? "active" : ""}
          aria-pressed={zone === option.value}
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const shortDate = (key: string) =>
  fromKey(key).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** La période de la zone en cours ce jour-là, sinon la prochaine ; rien
 *  passé la dernière période connue. */
export function nextSchoolVacation(zone: SchoolZone, today: Date) {
  const key = dateKey(today);
  const vacation = schoolVacationsForZone(zone).find(({ to }) => to >= key);
  return vacation ? { ...vacation, ongoing: vacation.from <= key } : null;
}

/** « Vacances de Noël » → « Noël », « Vacances d’été » → « été », « Vacances
 *  de la Toussaint » → « la Toussaint » : le mot « vacances » est déjà sur la
 *  ligne. */
export function vacationShortName(name: string) {
  return name.replace(/^Vacances (de |d’)/, "");
}

export function SchoolVacationMonthSummary({
  zone,
  vacations,
}: {
  zone: SchoolZone;
  vacations: SchoolVacation[];
}) {
  return (
    <aside className={`school-vacation-month-summary${vacations.length ? "" : " empty"}`}>
      <span className="school-vacation-swatch" aria-hidden="true" />
      <div>
        <strong>Vacances scolaires · Zone {zone}</strong>
        {vacations.length ? vacations.map((vacation) => (
          <small key={`${vacation.from}-${vacation.name}`}>
            {vacation.name} · {shortDate(vacation.from)} – {shortDate(vacation.to)}
          </small>
        )) : <small>Aucune période pendant ce mois.</small>}
      </div>
    </aside>
  );
}
