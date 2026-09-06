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
  return (
    <section className="school-vacation-settings" aria-label="Vacances scolaires">
      <button
        className={`school-vacation-switch${visible ? " active" : ""}`}
        type="button"
        role="switch"
        aria-checked={visible}
        onClick={() => onVisibleChange(!visible)}
      >
        <span aria-hidden="true"><i /></span>
        <strong>Vacances scolaires</strong>
        <small>{visible ? "Affichées dans le planning" : "Masquées"}</small>
      </button>
      {visible ? (
        <div className="school-zone-picker" role="group" aria-label="Zone scolaire affichée">
          {SCHOOL_ZONE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={zone === option.value ? "active" : ""}
              aria-pressed={zone === option.value}
              onClick={() => onZoneChange(option.value)}
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
