var CYCLE_ANCHOR_DAY = Math.floor(Date.UTC(2026, 6, 31) / 86400000);
var CYCLE_ANCHOR_INDEX = { 1: 3, 2: 10, 3: 17 };
var CYCLE_TYPES = [
  'work', 'work', 'work', 'work', 'work', 'work',
  'off', 'off', 'training',
  'work', 'work', 'work', 'work',
  'off', 'work', 'work',
  'off', 'off', 'off', 'off', 'off',
];
var HOLIDAY_CACHE = {};

export function dateKey(date) {
  return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
}

export function addDays(date, count) {
  var result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + count);
  return result;
}

function utcDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function easterSunday(year) {
  var a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function holidaysForYear(year) {
  var easter = easterSunday(year);
  var list = [
    [new Date(year, 0, 1), 'Jour de l’an'],
    [easter, 'Dimanche de Pâques'],
    [addDays(easter, 1), 'Lundi de Pâques'],
    [new Date(year, 4, 1), 'Fête du Travail'],
    [new Date(year, 4, 8), 'Victoire 1945'],
    [addDays(easter, 39), 'Ascension'],
    [addDays(easter, 49), 'Dimanche de Pentecôte'],
    [addDays(easter, 50), 'Lundi de Pentecôte'],
    [new Date(year, 6, 14), 'Fête nationale'],
    [new Date(year, 7, 15), 'Assomption'],
    [new Date(year, 10, 1), 'Toussaint'],
    [new Date(year, 10, 11), 'Armistice 1918'],
    [new Date(year, 11, 25), 'Noël'],
  ];
  var result = {};
  list.forEach(function (item) { result[dateKey(item[0])] = item[1]; });
  return result;
}

export function holidayName(date) {
  var year = date.getFullYear();
  if (!HOLIDAY_CACHE[year]) HOLIDAY_CACHE[year] = holidaysForYear(year);
  return HOLIDAY_CACHE[year][dateKey(date)] || '';
}

export function isAlwaysOffHoliday(date) {
  var month = date.getMonth() + 1, day = date.getDate();
  return (month === 5 && day === 1) || (month === 7 && day === 14) || (month === 12 && day === 25);
}

function baseCycleKind(date, group) {
  var delta = utcDayNumber(date) - CYCLE_ANCHOR_DAY;
  var index = ((CYCLE_ANCHOR_INDEX[group] + delta) % 21 + 21) % 21;
  return CYCLE_TYPES[index];
}

export function cycleInfoFor(date, group) {
  var holiday = holidayName(date);
  if (!group) return { kind: 'unknown', selectable: true, holiday: holiday, label: 'Renseignez le groupe 1, 2 ou 3 pour afficher le roulement.' };
  var baseKind = baseCycleKind(date, group);
  if (holiday && (isAlwaysOffHoliday(date) || baseKind === 'training')) {
    return { kind: 'off', selectable: false, special: true, holiday: holiday, label: holiday + ' — jour férié non travaillé' };
  }
  var label = baseKind === 'training' ? 'Formation' : (baseKind === 'work' ? 'Travail' : 'Repos');
  if (holiday) label = holiday + ' — ' + (baseKind === 'work' ? 'férié travaillé' : 'férié non travaillé');
  return { kind: baseKind, selectable: baseKind !== 'off', special: false, holiday: holiday, label: label };
}

export function countWorkedHolidays(year, group) {
  if (!group) return 0;
  var holidays = holidaysForYear(year), count = 0;
  Object.keys(holidays).forEach(function (key) {
    var parts = key.split('-'), date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (baseCycleKind(date, group) === 'work' && !isAlwaysOffHoliday(date)) count++;
  });
  return count;
}
