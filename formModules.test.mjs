import { describe, expect, it } from "vitest";
import {
  cleanFieldValue,
  expandFormYear,
  formatDateInput,
  formatTimeInput,
  parseFormDate,
  timeMinutes,
  timePart,
} from "./public/formulaire/form-value-utils.js";
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
});
