import { useId } from "react";

export const CLOCK_HOURS = [
  ...Array.from({ length: 17 }, (_, index) => index + 7),
  0,
  1,
  2,
] as const;
export const CLOCK_MINUTES = [0, 15, 30, 45] as const;

function clockParts(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  return {
    hour: CLOCK_HOURS.includes(hour as (typeof CLOCK_HOURS)[number]) ? hour : 9,
    minute: CLOCK_MINUTES.includes(minute as (typeof CLOCK_MINUTES)[number]) ? minute : 0,
  };
}

function clockValue(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function ClockTimePicker({
  label,
  value,
  onChange,
  className = "",
  pickerClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  pickerClassName?: string;
}) {
  const id = useId();
  const { hour, minute } = clockParts(value);
  return (
    <div className={`clock-time-field${className ? ` ${className}` : ""}`}>
      <span id={id}>{label}</span>
      <span className={`clock-time-picker${pickerClassName ? ` ${pickerClassName}` : ""}`} role="group" aria-labelledby={id}>
        <select aria-label={`${label} — heures`} value={hour} onChange={(event) => onChange(clockValue(Number(event.target.value), minute))}>
          {CLOCK_HOURS.map((option) => <option key={option} value={option}>{option} h</option>)}
        </select>
        <b aria-hidden="true">:</b>
        <select aria-label={`${label} — minutes`} value={minute} onChange={(event) => onChange(clockValue(hour, Number(event.target.value)))}>
          {CLOCK_MINUTES.map((option) => <option key={option} value={option}>{String(option).padStart(2, "0")}</option>)}
        </select>
      </span>
    </div>
  );
}
