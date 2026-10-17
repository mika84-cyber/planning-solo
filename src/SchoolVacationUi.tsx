import { useState } from "react";
import type { SchoolVacation, SchoolZone } from "./planningLogic";
import { SCHOOL_ZONE_OPTIONS, fromKey } from "./planningLogic";
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
}: {
  visible: boolean;
  zone: SchoolZone;
  onVisibleChange: (visible: boolean) => void;
  onZoneChange: (zone: SchoolZone) => void;
}) {
  /* Un réglage rare, sur une seule ligne : le nom et la zone à gauche (un
     appui déroule les zones), l'interrupteur à droite. */
  const [zonesOpen, setZonesOpen] = useState(false);
  const zoneLabel = SCHOOL_ZONE_OPTIONS.find((option) => option.value === zone)?.label ?? "";
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
      {zonesOpen ? (
        <div className="school-zone-picker" role="group" aria-label="Zone scolaire affichée">
          {SCHOOL_ZONE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={zone === option.value ? "active" : ""}
              aria-pressed={zone === option.value}
              onClick={() => { onZoneChange(option.value); setZonesOpen(false); }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const shortDate = (key: string) =>
  fromKey(key).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

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
