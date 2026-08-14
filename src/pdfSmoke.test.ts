import { describe, expect, it } from "vitest";
import { createAnnualPlanningPdf } from "./planningPdf";
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

  it("affiche la légende Année / Groupe / Jours fériés quand il n'y a pas de tableau de vacances", async () => {
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
    expect(text).toContain("Jours fériés");
  });

  it("n'affiche pas la légende quand le tableau de vacances est présent", async () => {
    const result = createAnnualPlanningPdf({
      year: 2026,
      groups: [2],
      getDayInfo,
      wasPompidouHolidayWorked,
      leaveSummary: { used: 0, remaining: 29 },
      schoolVacationDates: new Set(["2026-02-14"]),
      schoolVacations: [
        { name: "Vacances d'hiver", from: "2026-02-14", to: "2026-03-01" },
      ],
      filenameLabel: "test-tableau",
    });
    const text = await extractPdfText(await result.blob.arrayBuffer());
    expect(text).not.toContain("Jours fériés");
    expect(text).toContain("Vacances scolaires");
    // « 14 février 26 » et « 01 mars 26 », pas « 14/02/2026 ».
    expect(text).toContain("14 février 26");
    expect(text).toContain("01 mars 26");
    expect(text).not.toContain("14/02/2026");
    expect(text).not.toContain("/");
  });
});
