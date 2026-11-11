/* Feuilles déjà faites du formulaire de demande, gardées sur le compte pour
   être reprises depuis le téléphone comme depuis l'ordinateur. Seul le
   contenu des cases est gardé : ni signature, ni justificatif. La même
   vérification existe côté formulaire (public/formulaire/form-value-utils.js,
   normalizeFormSheet), qui la lit aussi dans un PDF rouvert. */

export const FORM_SHEET_IDS = ["conges", "recup", "echange", "ferie", "annul"] as const;
export const FORM_SHEETS_LIMIT = 20;
const FIELD_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_PAGES = 5;
const MAX_FIELDS = 200;

export type FormSheetPage = {
  f: Record<string, string>;
  m: string[];
  c: Record<string, true>;
};

export type FormSheet = {
  id: string;
  sheet: (typeof FORM_SHEET_IDS)[number];
  pages: FormSheetPage[];
  o: string;
  created_at: string;
  updated_at: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function sanitizePage(raw: unknown): FormSheetPage | null {
  if (!isRecord(raw) || !isRecord(raw.f)) return null;
  const fields = Object.entries(raw.f);
  if (fields.length > MAX_FIELDS) return null;
  const f: Record<string, string> = {};
  for (const [name, value] of fields) {
    if (!FIELD_NAME.test(name) || typeof value !== "string" || value.length > 200) return null;
    if (value) f[name] = value;
  }
  const m = Array.isArray(raw.m)
    ? raw.m.filter((name): name is string => typeof name === "string" && FIELD_NAME.test(name) && Object.prototype.hasOwnProperty.call(f, name)).slice(0, MAX_FIELDS)
    : [];
  const c: Record<string, true> = {};
  if (isRecord(raw.c))
    for (const [name, value] of Object.entries(raw.c).slice(0, MAX_FIELDS))
      if (FIELD_NAME.test(name) && value === true) c[name] = true;
  return { f, m, c };
}

const isoOr = (value: unknown, fallback: string) =>
  typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;

/** Une feuille envoyée par le formulaire, ou `null` si quoi que ce soit
 *  sort du cadre attendu. */
export function sanitizeFormSheet(raw: unknown, now = new Date().toISOString()): FormSheet | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !/^[a-z0-9]{8,40}$/.test(raw.id)) return null;
  if (!FORM_SHEET_IDS.includes(raw.sheet as FormSheet["sheet"])) return null;
  if (!Array.isArray(raw.pages) || !raw.pages.length || raw.pages.length > MAX_PAGES) return null;
  const pages = raw.pages.map(sanitizePage);
  if (pages.some((page) => !page)) return null;
  if (raw.o !== undefined && (typeof raw.o !== "string" || raw.o.length > 1000)) return null;
  return {
    id: raw.id,
    sheet: raw.sheet as FormSheet["sheet"],
    pages: pages as FormSheetPage[],
    o: typeof raw.o === "string" ? raw.o : "",
    created_at: isoOr(raw.created_at, now),
    updated_at: now,
  };
}

/** Les feuilles gardées, relues sans jamais faire confiance au stockage. */
export function readFormSheets(raw: unknown): FormSheet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (isRecord(item) ? sanitizeFormSheet(item, isoOr(item.updated_at, new Date(0).toISOString())) : null))
    .filter((item): item is FormSheet => Boolean(item))
    .slice(0, FORM_SHEETS_LIMIT);
}

const contentKey = (sheet: FormSheet) => JSON.stringify([sheet.sheet, sheet.pages, sheet.o]);

/** La nouvelle feuille passe en tête. Elle remplace celle qui porte son
 *  numéro (une feuille reprise puis modifiée) et celle au contenu identique
 *  (le même PDF imprimé puis téléchargé), dont elle garde la date de
 *  création. Seules les vingt plus récentes restent. */
export function mergeFormSheets(list: FormSheet[], sheet: FormSheet): FormSheet[] {
  const key = contentKey(sheet);
  const replaced = list.filter((item) => item.id === sheet.id || contentKey(item) === key);
  const created = replaced.map((item) => item.created_at).sort()[0];
  return [
    { ...sheet, created_at: created && created < sheet.created_at ? created : sheet.created_at },
    ...list.filter((item) => !replaced.includes(item)),
  ].slice(0, FORM_SHEETS_LIMIT);
}
