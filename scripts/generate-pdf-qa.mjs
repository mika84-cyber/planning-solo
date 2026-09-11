import { readFile, readdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const asset = (await readdir("qa-pdf-dist")).find((name) => name.startsWith("planning-pdf-qa") && name.endsWith(".js"));
if (!asset) throw new Error("Module PDF construit introuvable.");
const { createAnnualPlanningPdf } = await import(pathToFileURL(resolve("qa-pdf-dist", asset)).href);
const pngDataUrl = async (path) => `data:image/png;base64,${(await readFile(path)).toString("base64")}`;
const assets = {
  exchange: await pngDataUrl("public/exchange-arrows.png"),
  workAccident: await pngDataUrl("public/work-accident-icon.png"),
};

const leaveTypes = new Map([
  ["2027-01-02", "annual"],
  ["2027-01-03", "rtt"],
  ["2027-01-04", "fraction"],
  ["2027-01-05", "childcare"],
  ["2027-01-06", "exceptional"],
  ["2027-01-07", "half"],
  ["2027-01-08", "half"],
  ["2027-01-09", "work_accident"],
  ["2027-01-10", "work_accident"],
  ["2027-01-11", "work_accident"],
  ["2027-01-12", "work_accident"],
  ["2027-01-13", "work_accident"],
  ["2027-01-14", "work_accident"],
]);
const sharedVacations = [
  { name: "Vacances de Noël", from: "2026-12-19", to: "2027-01-03" },
  { name: "Vacances d’été", from: "2027-07-03", to: "2027-09-01" },
  { name: "Vacances de la Toussaint", from: "2027-10-23", to: "2027-11-07" },
  { name: "Vacances de Noël", from: "2027-12-18", to: "2028-01-02" },
];
const schoolVacationsByZone = {
  A: [
    { name: "Vacances d’hiver", from: "2027-02-13", to: "2027-02-28" },
    { name: "Vacances de printemps", from: "2027-04-10", to: "2027-04-25" },
    ...sharedVacations,
  ],
  B: [
    { name: "Vacances d’hiver", from: "2027-02-20", to: "2027-03-07" },
    { name: "Vacances de printemps", from: "2027-04-17", to: "2027-05-02" },
    ...sharedVacations,
  ],
  C: [
    { name: "Vacances d’hiver", from: "2027-02-06", to: "2027-02-21" },
    { name: "Vacances de printemps", from: "2027-04-03", to: "2027-04-18" },
    ...sharedVacations,
  ],
};
for (const zone of ["A", "B", "C"])
  schoolVacationsByZone[zone].sort((a, b) => a.from.localeCompare(b.from));
const pdfOptions = {
  year: 2027,
  groups: [2],
  getDayInfo: (date) => {
    const month = date.getMonth();
    const day = date.getDate();
    if (month === 0 && [10, 13].includes(day))
      return { kind: "training", holiday: "" };
    if (month === 0 && [11, 14].includes(day))
      return { kind: "off", holiday: "" };
    if (month === 1 && day === 10)
      return { kind: "off", holiday: "" };
    if (month === 1 && day === 11)
      return { kind: "training", holiday: "" };
    if (month === 2 && day === 14)
      return { kind: "training", holiday: "" };
    if (month === 0 && day === 1)
      return { kind: "work", holiday: "Jour de l’an" };
    if (month === 4 && day === 1)
      return { kind: "off", holiday: "Fête du Travail" };
    return { kind: "work", holiday: "" };
  },
  wasPompidouHolidayWorked: (date) => date.getMonth() === 4 && date.getDate() === 1,
  leaveTypes,
  halfMoments: new Map([
    ["2027-01-07", "morning"],
    ["2027-01-08", "afternoon"],
  ]),
  leaveSummary: { used: 6, remaining: 23 },
  schoolVacationsByZone,
  closedDates: new Set(["2027-02-09", "2027-02-10", "2027-02-11", "2027-03-14"]),
  exchangeMarkers: new Map([
    ["2027-01-18", { number: 1, role: "given" }],
    ["2027-02-12", { number: 1, role: "return" }],
    ["2027-03-13", { number: 2, role: "given" }],
    ["2027-08-14", { number: 2, role: "return" }],
  ]),
  assets,
  filenameLabel: "controle-local",
};
const result = createAnnualPlanningPdf(pdfOptions);
await writeFile("qa-planning.pdf", Buffer.from(await result.blob.arrayBuffer()));
const noVacationsResult = createAnnualPlanningPdf({
  ...pdfOptions,
  schoolVacationsByZone: undefined,
  filenameLabel: "controle-local-sans-vacances",
});
await writeFile(
  "qa-planning-no-vacations.pdf",
  Buffer.from(await noVacationsResult.blob.arrayBuffer()),
);
const noLeaveLegendResult = createAnnualPlanningPdf({
  ...pdfOptions,
  groups: [1, 2, 3],
  leaveTypes: undefined,
  halfMoments: undefined,
  leaveSummary: undefined,
  showColorLegend: false,
  filenameLabel: "controle-local-sans-conges",
});
await writeFile(
  "qa-planning-no-leave-legend.pdf",
  Buffer.from(await noLeaveLegendResult.blob.arrayBuffer()),
);
