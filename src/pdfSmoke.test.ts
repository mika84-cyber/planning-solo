import { describe, expect, it } from "vitest";
import {
  buildWorkedHolidaySchedule,
  createAnnualPlanningPdf,
  createWorkedHolidaysPdf,
} from "./planningPdf";
import { dateKey, getDayInfo, wasPompidouHolidayWorked } from "./planningLogic";

/* Un mini-lecteur de PDF, pour vérifier ce que jsPDF a réellement écrit plutôt
 *  que de se fier à l'absence d'exception. Même principe que
 *  `extractPayslipTokens` (payslip.ts) pour de vrais bulletins, mais celle-ci
 *  n'a jamais eu à composer avec jsPDF : ici l'EOL posé juste avant
 *  « endstream » (obligatoire selon la spec PDF, mais hors du flux compressé
 *  lui-même) doit être retranché avant d'inflate, sans quoi
 *  `DecompressionStream` refuse le flux entier plutôt que de l'ignorer. */
function latin1(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192)
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
}
async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const raw = latin1(bytes);
  let content = "";
  let cursor = 0;
  while (true) {
    const start = raw.indexOf("stream", cursor);
    if (start === -1) break;
    let begin = start + 6;
    if (raw.charCodeAt(begin) === 13) begin++;
    if (raw.charCodeAt(begin) === 10) begin++;
    let end = raw.indexOf("endstream", begin);
    if (end === -1) break;
    if (raw.charCodeAt(end - 1) === 10) end--;
    if (raw.charCodeAt(end - 1) === 13) end--;
    const inflated = await inflate(bytes.subarray(begin, end));
    content += inflated ? latin1(inflated) : raw.slice(begin, end);
    cursor = raw.indexOf("endstream", end) + 9;
  }
  const texts: string[] = [];
  for (const match of content.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g))
    texts.push(match[1]);
  for (const match of content.matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ/g))
    texts.push(
      [...match[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)]
        .map((piece) => piece[1])
        .join(""),
    );
  return texts.join(" ");
}

describe("createAnnualPlanningPdf (fumée)", () => {
  it("produit un PDF avec des vacances scolaires sur des cases de couleurs différentes", () => {
    const schoolVacationDates = new Set([
      "2026-02-14",
      "2026-02-15",
      "2026-02-16",
      "2026-02-17",
      "2026-02-18",
    ]);
    const leaveTypes = new Map<string, "annual">([["2026-02-16", "annual"]]);
    const result = createAnnualPlanningPdf({
      year: 2026,
      groups: [2],
      getDayInfo,
      wasPompidouHolidayWorked,
      leaveTypes,
      leaveSummary: { used: 3, remaining: 26 },
      schoolVacationDates,
      filenameLabel: "test",
    });
    expect(result.blob.size).toBeGreaterThan(1000);
    expect(result.filename).toBe("planning-2026-test.pdf");
    expect(dateKey(new Date(2026, 1, 14))).toBe("2026-02-14");
  });

  it("identifie chaque type de congé, y compris une demi-journée", async () => {
    const leaveTypes = new Map([
      ["2026-01-01", "annual"],
      ["2026-01-02", "rtt"],
      ["2026-01-03", "fraction"],
      ["2026-01-04", "sick"],
      ["2026-01-05", "childcare"],
      ["2026-01-06", "exceptional"],
      ["2026-01-07", "half"],
      ["2026-01-08", "strike"],
      ["2026-01-09", "cet"],
      ["2026-01-10", "other"],
      ["2026-01-11", "recovery"],
    ] as const);
    const result = createAnnualPlanningPdf({
      year: 2026,
      groups: [1],
      getDayInfo: () => ({ kind: "work", holiday: "" }),
      wasPompidouHolidayWorked: () => false,
      leaveTypes,
      halfMoments: new Map([["2026-01-07", "afternoon"]]),
      filenameLabel: "test-types",
    });
    const text = await extractPdfText(await result.blob.arrayBuffer());
    expect(text).toContain("CA");
    expect(text).toContain("RTT");
    expect(text).toContain("Fraction.");
    expect(text).toContain("Maladie");
    expect(text).toContain("Garde d'enfant");
    expect(text).toContain("ASA");
    expect(text).toContain("½ CA");
    expect(text).toContain("Grève");
    expect(text).toContain("CET");
    expect(text).toContain("Divers");
    expect(text).toContain("Récup");
  });

  it("conserve une absence enregistrée sur un repos ou un jour férié", async () => {
    const leaveTypes = new Map([
      ["2026-01-01", "strike"],
      ["2026-01-02", "other"],
    ] as const);
    const result = createAnnualPlanningPdf({
      year: 2026,
      groups: [1],
      getDayInfo: (date) =>
        date.getDate() === 1
          ? { kind: "off", holiday: "Jour de l'an" }
          : { kind: "off", holiday: "" },
      wasPompidouHolidayWorked: () => false,
      leaveTypes,
      filenameLabel: "test-absence-sur-repos",
    });
    const text = await extractPdfText(await result.blob.arrayBuffer());
    expect(text).toContain("Grève");
    expect(text).toContain("Divers");
  });

  it("affiche la colonne Année / Groupe / Fériés et sa légende", async () => {
    const result = createAnnualPlanningPdf({
      year: 2026,
      groups: [2],
      getDayInfo,
      wasPompidouHolidayWorked,
      filenameLabel: "test-legende",
    });
    const text = await extractPdfText(await result.blob.arrayBuffer());
    expect(text).toContain("Année");
    expect(text).toContain("Groupe");
    expect(text).toContain("Fériés travaillés");
    expect(text).toContain("Fériés compensés");
    expect(text).toContain("Férié compensé");
    expect(text).toContain("Congé validé");
    expect(text).toContain("Maladie");
    expect(text).toContain("Garde d'enfant");
    expect(text).toContain("Grève");
    expect(text).toContain("Divers");
  });

  it("conserve la légende lisible avec le tableau de vacances des trois zones", async () => {
    const result = createAnnualPlanningPdf({
      year: 2026,
      groups: [2],
      getDayInfo,
      wasPompidouHolidayWorked,
      leaveSummary: { used: 0, remaining: 29 },
      schoolVacationDates: new Set(["2026-02-14"]),
      schoolVacationsByZone: {
        A: [{ name: "Vacances d'hiver", from: "2026-02-14", to: "2026-03-01" }],
        B: [{ name: "Vacances d'hiver", from: "2026-02-21", to: "2026-03-08" }],
        C: [{ name: "Vacances d'hiver", from: "2026-02-07", to: "2026-02-22" }],
      },
      filenameLabel: "test-tableau",
    });
    const text = await extractPdfText(await result.blob.arrayBuffer());
    expect(text).not.toContain("Jours fériés");
    expect(text).toContain("Congé validé");
    expect(text).toContain("Vacances scolaires");
    expect(text).toContain("Zone A");
    expect(text).toContain("Zone B");
    expect(text).toContain("Zone C");
    // « 14 février 26 » et « 01 mars 26 », pas « 14/02/2026 ».
    expect(text).toContain("14 février 26");
    expect(text).toContain("01 mars 26");
    expect(text).toContain("21 février 26");
    expect(text).toContain("07 février 26");
    expect(text).not.toContain("14/02/2026");
    expect(text).not.toContain("/");
  });
});

describe("tableau des fériés réellement travaillés", () => {
  it("conserve seulement les groupes présents et exclut un férié compensé", () => {
    const schedule = buildWorkedHolidaySchedule(2026, 2026, (date, group) => {
      if (date.getMonth() !== 0 || ![1, 2].includes(date.getDate()))
        return { kind: "off", holiday: "" };
      if (date.getDate() === 2)
        return { kind: "off", holiday: "Férié compensé" };
      return {
        kind: group === 2 ? "off" : "work",
        holiday: "Jour réellement travaillé",
      };
    });
    expect(schedule).toEqual([
      {
        year: 2026,
        entries: [
          {
            key: "2026-01-01",
            name: "Jour réellement travaillé",
            groups: [1, 3],
          },
        ],
      },
    ]);
  });

  it("génère le récapitulatif 2026–2031 sur une page", async () => {
    const result = createWorkedHolidaysPdf({ getDayInfo });
    expect(result.filename).toBe("feries-travailles-2026-2031.pdf");
    expect(result.schedule).toHaveLength(6);
    expect(result.schedule.every(({ entries }) => entries.every(({ groups }) => groups.length > 0))).toBe(true);
    expect(result.blob.size).toBeGreaterThan(1000);
    const text = await extractPdfText(await result.blob.arrayBuffer());
    expect(text).toContain("Jours fériés travaillés");
    expect(text).not.toContain("réellement travaillés");
    expect(text).toContain("Tableau pour faciliter les échanges");
    expect(text).not.toContain("Pour faciliter les échanges sur jours fériés");
    expect(text).toContain("2026");
    expect(text).toContain("2031");
    expect(text).not.toContain("Lecture du tableau");
    expect(text).not.toContain("Les fériés compensés");
  });
});
