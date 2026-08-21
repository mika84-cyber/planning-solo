import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  calculateNetRatios,
  extractPayslipTokens,
  inspectNetRatioCalibration,
  readPayslip,
} from "../../src/payslip.ts";

const archive = "D:\\Downloads\\archive_09-Aug-2026_01_30_40.851277_6767365_mypeopledoc";
const names = (await readdir(archive)).filter((name) => name.endsWith(".pdf")).sort();
const rows = [];
for (const name of names) {
  const bytes = await readFile(join(archive, name));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const reading = readPayslip(await extractPayslipTokens(buffer));
  rows.push({ period: name.match(/(20\d\d-\d\d)-01/)?.[1], reading });
}
const groups = {
  all: rows,
  preMgen: rows.filter((item) => item.period < "2025-10"),
  postMgen: rows.filter((item) => item.period >= "2025-10"),
  year2026: rows.filter((item) => item.period.startsWith("2026-")),
};
console.log(JSON.stringify({
  count: rows.length,
  unreadable: rows.filter(({ reading }) =>
    reading.gross === undefined || reading.baseSalary === undefined || reading.netBeforeTax === undefined
  ).map(({ period }) => period),
  rates: Object.fromEntries(
    Object.entries(groups).map(([key, items]) => [
      key,
      {
        calculated: calculateNetRatios(items.map((item) => item.reading)),
        inspection: inspectNetRatioCalibration(items.map((item) => item.reading)),
      },
    ]),
  ),
  periods: rows.map(({ period, reading }) => ({
    period,
    gross: reading.gross,
    netBeforeTax: reading.netBeforeTax,
    baseSalary: reading.baseSalary,
    otherFixed: reading.otherFixed,
    carenceDay: reading.carenceDay,
    pasRate: reading.pasRate,
  })),
}, null, 2));
