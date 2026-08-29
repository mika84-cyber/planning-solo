export function formatDateInput(value) {
  var digits = String(value).replace(/\D/g, '').slice(0, 8);
  var output = digits.slice(0, 2);
  if (digits.length > 2) output += '/' + digits.slice(2, 4);
  if (digits.length > 4) output += '/' + digits.slice(4, 8);
  return output;
}

export function formatTimeInput(value) {
  var digits = String(value).replace(/\D/g, '').slice(0, 4);
  return digits.length === 4 ? digits.slice(0, 2) + 'h' + digits.slice(2) : digits;
}

export function normalizeTime(value) {
  var digits = String(value).replace(/\D/g, '');
  if (digits.length === 3) return digits.slice(0, 1) + 'h' + digits.slice(1);
  if (digits.length === 4) return digits.slice(0, 2) + 'h' + digits.slice(2);
  return value;
}

export function cleanFieldValue(field, value) {
  if (field.k === 'date') return formatDateInput(value);
  if (field.k === 'time') return formatTimeInput(value);
  if (field.k === 'soit') return String(value).replace(/[^0-9.,hH]/g, '').replace('.', ',').slice(0, 6);
  return value;
}

export function timePart(value, index) {
  var digits = String(value).replace(/\D/g, '');
  if (digits.length === 3) digits = '0' + digits;
  return index === 0 ? digits.slice(0, 2) : digits.slice(2, 4);
}

export function timeMinutes(value) {
  var digits = String(value).replace(/\D/g, '');
  if (digits.length === 3) digits = '0' + digits;
  if (digits.length !== 4) return null;
  var hours = +digits.slice(0, 2);
  var minutes = +digits.slice(2, 4);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function parseFormDate(value) {
  var match = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec((value || '').trim());
  if (!match) return null;
  var year = match[3].length === 2 ? 2000 + +match[3] : +match[3];
  var date = new Date(year, +match[2] - 1, +match[1]);
  return date.getDate() === +match[1] && date.getMonth() === +match[2] - 1 && date.getFullYear() === year
    ? date
    : null;
}

export function expandFormYear(value) {
  var match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec((value || '').trim());
  return match ? match[1] + '/' + match[2] + '/20' + match[3] : value;
}

export function timeText(total) {
  return ('0' + Math.floor(total / 60)).slice(-2) + 'h' + ('0' + (total % 60)).slice(-2);
}

export function clampTimeMinutes(value, fallback, minimum, maximum, step) {
  if (value === null) return fallback;
  var rounded = Math.round(value / step) * step;
  return Math.max(minimum, Math.min(maximum, rounded));
}
