import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cleanFieldValue,
  expandFormYear,
  formatDateInput,
  formatTimeInput,
  formSheetSummary,
  mergeFormSheets,
  normalizeFormSheet,
  parseFormDate,
  timeMinutes,
  timePart,
} from "./public/formulaire/form-value-utils.js";
import { readFormSheets, sanitizeFormSheet } from "./netlify/lib/formSheets.mts";
import {
  countWorkedHolidays,
  cycleInfoFor,
  dateKey,
  holidayName,
} from "./public/formulaire/form-calendar.js";
import { findPdfHeader, humanFileSize } from "./public/formulaire/form-file-utils.js";
import {
  signatureStrokeWidth,
  usesPersistentMobileSignature,
} from "./public/formulaire/form-signature-controller.js";

describe("modules purs du formulaire autonome", () => {
  it("conserve les masques et validations des dates et horaires", () => {
    expect(formatDateInput("27082026")).toBe("27/08/2026");
    expect(formatTimeInput("0915")).toBe("09h15");
    expect(timeMinutes("9h15")).toBe(555);
    expect(timeMinutes("25h00")).toBeNull();
    expect(timePart("9h15", 0)).toBe("09");
    expect(cleanFieldValue({ k: "soit" }, "3.5 jours")).toBe("3,5");
    expect(expandFormYear("27/08/26")).toBe("27/08/2026");
    expect(parseFormDate("31/02/2026")).toBeNull();
  });

  it("préserve le cycle et les jours fériés du calendrier", () => {
    var bastilleDay = new Date(2026, 6, 14);
    expect(dateKey(bastilleDay)).toBe("2026-07-14");
    expect(holidayName(bastilleDay)).toBe("Fête nationale");
    expect(cycleInfoFor(bastilleDay, 1)).toMatchObject({
      kind: "off",
      selectable: false,
      special: true,
    });
    expect(countWorkedHolidays(2026, 2)).toBeGreaterThanOrEqual(0);
  });

  it("valide un en-tête PDF binaire et les tailles affichées", () => {
    expect(findPdfHeader(new Uint8Array([0, 1, 0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(2);
    expect(findPdfHeader(new Uint8Array([1, 2, 3, 4]))).toBe(-1);
    expect(humanFileSize(1536)).toBe("2 Ko");
    expect(humanFileSize(1572864)).toBe("1,5 Mo");
  });

  it("adapte sans état global la persistance et l’épaisseur de la signature", () => {
    const mobileWindow = {
      matchMedia: (query) => ({ matches: query === "(pointer:coarse)" }),
    };
    expect(usesPersistentMobileSignature(mobileWindow)).toBe(true);
    expect(
      signatureStrokeWidth({
        panelZoom: 1,
        browserZoom: 1,
        finePointer: true,
        stroke: "normal",
      }),
    ).toBe(2.8);
    expect(
      signatureStrokeWidth({
        panelZoom: 2,
        browserZoom: 1.5,
        finePointer: false,
        stroke: "thick",
      }),
    ).toBeCloseTo(1.75, 2);
  });

  describe("feuilles déjà faites", () => {
    const SHEETS = new Function(`${readFileSync("public/formulaire/sheets.js", "utf8")}; return SHEETS;`)();
    const ids = SHEETS.map((sheet) => sheet.id);
    const fieldsOf = (id) => SHEETS.find((sheet) => sheet.id === id).fields;
    const sheet = (id, f, extra = {}) => ({
      id,
      sheet: "conges",
      pages: [{ f, m: [], c: {} }],
      o: "",
      created_at: "2026-11-01T08:00:00.000Z",
      updated_at: "2026-11-01T08:00:00.000Z",
      ...extra,
    });

    it("accepte tous les noms de cases des feuilles, côté formulaire comme côté compte", () => {
      expect(ids).toEqual(["conges", "recup", "echange", "ferie", "annul"]);
      for (const model of SHEETS) {
        const page = { f: Object.fromEntries(model.fields.map((field) => [field.n, "x"])), m: [], c: Object.fromEntries((model.checks || []).map((check) => [check.n, true])) };
        const raw = { id: "feuille001", sheet: model.id, pages: [page], o: "" };
        expect(normalizeFormSheet(raw, ids)?.pages[0].f, model.id).toEqual(page.f);
        expect(sanitizeFormSheet(raw)?.pages[0], model.id).toEqual(page);
      }
    });

    it("refuse ce qui sort du cadre, comme le compte", () => {
      const base = sheet("feuille001", { nom: "A" });
      for (const raw of [
        null,
        { ...base, id: "court" },
        { ...base, sheet: "autre" },
        { ...base, pages: [] },
        { ...base, pages: [{ f: { "<b>": "A" } }] },
        { ...base, pages: [{ f: { nom: 3 } }] },
        { ...base, o: "x".repeat(1001) },
      ]) {
        expect(normalizeFormSheet(raw, ids)).toBeNull();
        expect(sanitizeFormSheet(raw)).toBeNull();
      }
      // Cases vides retirées, cases cochées et saisies manuelles gardées si elles existent.
      expect(normalizeFormSheet({ ...base, pages: [{ f: { nom: "A", groupe: "" }, m: ["nom", "groupe"], c: { opt_conges: true, opt_recup: false } }] }, ids).pages)
        .toEqual([{ f: { nom: "A" }, m: ["nom"], c: { opt_conges: true } }]);
      expect(readFormSheets([base, { bad: true }, "texte"])).toHaveLength(1);
    });

    it("garde une seule ligne par feuille, en tête, vingt au plus", () => {
      const first = sheet("feuille001", { nom: "A", ca0_from: "21/12/2026" });
      const copy = sheet("feuille002", { nom: "A", ca0_from: "21/12/2026" }, { created_at: "2026-11-05T08:00:00.000Z" });
      expect(mergeFormSheets([first], copy)).toEqual([{ ...copy, created_at: first.created_at }]);
      const edited = sheet("feuille001", { nom: "A", ca0_from: "22/12/2026" }, { created_at: "2026-11-06T08:00:00.000Z" });
      const other = sheet("feuille003", { nom: "B" });
      expect(mergeFormSheets([other, first], edited).map((item) => item.id)).toEqual(["feuille001", "feuille003"]);
      const many = Array.from({ length: 20 }, (_, index) => sheet(`feuille1${String(index).padStart(2, "0")}`, { nom: `N${index}` }));
      expect(mergeFormSheets(many, other)).toHaveLength(20);
      expect(mergeFormSheets(many, other)[0].id).toBe("feuille003");
    });

    it("résume la feuille en une ligne reconnaissable", () => {
      expect(formSheetSummary(fieldsOf("conges"), [
        { f: { nom: "A", ca0_from: "21/12/2026", ca0_to: "02/01/2027", date_sig: "11/11/2026" } },
        { f: { half0_from: "15/12/2026" } },
      ])).toBe("Congés annuels, du 15/12 au 02/01");
      expect(formSheetSummary(fieldsOf("recup"), [{ f: { rjour0_from: "28/11/2026" } }])).toBe("Récupérations journées, le 28/11");
      expect(formSheetSummary(fieldsOf("echange"), [{ f: { collegue: "Léa Martin", rep_date: "14/11/2026", ech_date: "21/11/2026" } }]))
        .toBe("Avec Léa Martin, du 14/11 au 21/11");
      expect(formSheetSummary(fieldsOf("conges"), [{ f: { nom: "A", date_sig: "11/11/2026" } }])).toBe("Sans date");
    });
  });
});
