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

/* Feuilles déjà faites : la même vérification que sur le compte
   (netlify/lib/formSheets.mts), pour la liste gardée sur l'appareil et pour
   la feuille glissée dans un PDF qu'on rouvre. Seul le contenu des cases. */
var SHEET_FIELD = /^[a-z][a-z0-9_]{0,39}$/;
function own(object, name) { return Object.prototype.hasOwnProperty.call(object, name); }
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isoDate(value) {
  return typeof value === 'string' && value.length <= 40 && isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
}

export function normalizeFormSheet(raw, sheetIds) {
  if (!isPlainObject(raw) || typeof raw.id !== 'string' || !/^[a-z0-9]{8,40}$/.test(raw.id)) return null;
  if (sheetIds.indexOf(raw.sheet) < 0 || !Array.isArray(raw.pages) || !raw.pages.length || raw.pages.length > 5) return null;
  if (raw.o !== undefined && (typeof raw.o !== 'string' || raw.o.length > 1000)) return null;
  var pages = [];
  for (var index = 0; index < raw.pages.length; index++) {
    var page = raw.pages[index];
    if (!isPlainObject(page) || !isPlainObject(page.f)) return null;
    var names = Object.keys(page.f), fields = {}, checks = {};
    if (names.length > 200) return null;
    for (var n = 0; n < names.length; n++) {
      var value = page.f[names[n]];
      if (!SHEET_FIELD.test(names[n]) || typeof value !== 'string' || value.length > 200) return null;
      if (value) fields[names[n]] = value;
    }
    if (isPlainObject(page.c)) Object.keys(page.c).slice(0, 200).forEach(function (name) {
      if (SHEET_FIELD.test(name) && page.c[name] === true) checks[name] = true;
    });
    pages.push({
      f: fields,
      m: Array.isArray(page.m) ? page.m.filter(function (name) { return typeof name === 'string' && own(fields, name); }).slice(0, 200) : [],
      c: checks,
    });
  }
  return { id: raw.id, sheet: raw.sheet, pages: pages, o: raw.o || '', created_at: isoDate(raw.created_at), updated_at: isoDate(raw.updated_at) };
}

/* La feuille passe en tête et remplace celle qui porte son numéro (reprise
   puis modifiée) ou au contenu identique (imprimée puis téléchargée), dont
   elle garde la date de création. Vingt au plus. */
export function mergeFormSheets(list, sheet) {
  var key = JSON.stringify([sheet.sheet, sheet.pages, sheet.o]), created = sheet.created_at;
  var rest = list.filter(function (item) {
    var same = item.id === sheet.id || JSON.stringify([item.sheet, item.pages, item.o]) === key;
    if (same && item.created_at && item.created_at < created) created = item.created_at;
    return !same;
  });
  return [Object.assign({}, sheet, { created_at: created })].concat(rest).slice(0, 20);
}

/* Une ligne pour reconnaître la feuille : la rubrique de la première date,
   ou le collègue d'un échange, puis la période couverte. */
export function formSheetSummary(fields, pages) {
  var dates = [], section = '', colleague = '';
  pages.forEach(function (page) {
    fields.forEach(function (field) {
      var value = own(page.f, field.n) ? page.f[field.n] : '';
      if (!value) return;
      if (field.n === 'collegue' && !colleague) colleague = value;
      var date = field.k === 'date' && field.n !== 'date_sig' ? parseFormDate(value) : null;
      if (!date) return;
      dates.push(date);
      if (!section) section = String(field.l || '').split(' — ')[0];
    });
  });
  dates.sort(function (a, b) { return a - b; });
  var day = function (date) { return ('0' + date.getDate()).slice(-2) + '/' + ('0' + (date.getMonth() + 1)).slice(-2); };
  var last = dates[dates.length - 1];
  var when = !dates.length ? '' : +dates[0] === +last ? 'le ' + day(last) : 'du ' + day(dates[0]) + ' au ' + day(last);
  var head = colleague ? 'Avec ' + colleague : section;
  if (head) return when ? head + ', ' + when : head;
  return when ? when.charAt(0).toUpperCase() + when.slice(1) : 'Sans date';
}
