import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const feature = process.argv[2];

const features = {
  planning: {
    description: "planning mensuel/annuel, groupes, cases et nettoyage",
    files: [
      "src/CalendarCleanup.tsx",
      "src/HomeDashboard.tsx",
      "src/PlanningCommandCenter.tsx",
      "src/PlanningDayCell.tsx",
      "src/PlanningView.tsx",
      "src/useCalendarDataState.ts",
      "src/usePlanningEntryActions.ts",
      "src/usePlanningUiState.ts",
      "src/planningLogic.ts",
      "src/planningLogic.test.ts",
      "src/appModel.ts",
      "src/ChoicePicker.tsx",
    ],
    appTerms: [
      "<PlanningCommandCenter",
      "<PlanningDayCell",
      "<MonthCalendar",
      "calendarDeleteMode",
      'homeSection === "home"',
    ],
    styleTerms: [".calendar-toolbar", ".calendar-grid", ".day {", ".calendar-delete"],
  },
  leave: {
    description: "congés, soldes, récupérations et demandes",
    files: [
      "src/LeaveManagementPage.tsx",
      "src/LeaveBalancesSection.tsx",
      "src/LeaveDialogs.tsx",
      "src/leaveRequest.ts",
      "src/leaveRequest.test.ts",
      "src/overtime.ts",
      "src/overtime.test.ts",
      "src/planningLogic.ts",
    ],
    appTerms: ["const leaveStats", "const balanceDetailMonths", "<LeaveManagementPage"],
    styleTerms: [".leave-balance", ".balance-detail", ".manual-adjustment", ".recovery-"],
  },
  pay: {
    description: "paie, bulletins, heures supplémentaires, mécénats et primes",
    files: [
      "src/PayPage.tsx",
      "src/PayAllowancesSection.tsx",
      "src/PayslipCheckSection.tsx",
      "src/PayEstimateDetails.tsx",
      "src/WorkTimeDialogs.tsx",
      "src/usePayUiState.ts",
      "src/useWorkTimeUiState.ts",
      "src/payEstimate.ts",
      "src/payEstimate.test.ts",
      "src/payslip.ts",
      "src/payslipReview.ts",
      "src/overtime.ts",
      "src/mecenat.ts",
      "src/mecenatRegulation.ts",
    ],
    appTerms: ["<PayPage", "<PayAllowancesSection", "<PayslipCheckSection"],
    styleTerms: [".pay-", ".allowance-", ".overtime-", ".mecenat-"],
  },
  pwa: {
    description: "installation, hors-ligne et mise à jour de la PWA",
    files: [
      "src/main.tsx",
      "src/useInstallPrompt.ts",
      "public/sw.js",
      "public/manifest.webmanifest",
    ],
    appTerms: ["function checkForAppUpdate", "app-update-button", "installPrompt"],
    styleTerms: [".app-update-button", ".install-app-button"],
  },
  form: {
    description: "formulaire autonome de demande",
    files: [
      "public/formulaire/index.html",
      "public/formulaire/device.js",
      "public/formulaire/sheets.js",
      "public/formulaire/app.js",
      "public/formulaire/form.css",
      "formSecurity.test.mjs",
    ],
    appTerms: ["function openBlankForm", "function validateAndOpenForm", "HANDOFF_KEY"],
    styleTerms: [],
  },
};

if (!feature || !features[feature]) {
  console.error(`Rubrique attendue : ${Object.keys(features).join(" | ")}`);
  process.exitCode = 1;
} else {
  const config = features[feature];
  const output = [];
  const addFile = (relativePath, content) => {
    const language = {
      ".ts": "ts",
      ".tsx": "tsx",
      ".js": "js",
      ".mjs": "js",
      ".css": "css",
      ".html": "html",
      ".md": "md",
    }[extname(relativePath)] ?? "text";
    output.push(`## ${relativePath}\n\n\`\`\`${language}\n${content}\n\`\`\``);
  };
  const extractWindows = (relativePath, terms, radius) => {
    const lines = readFileSync(join(root, relativePath), "utf8").split(/\r?\n/);
    const ranges = [];
    for (const term of terms) {
      lines.forEach((line, index) => {
        if (!line.includes(term)) return;
        ranges.push([Math.max(0, index - radius), Math.min(lines.length - 1, index + radius)]);
      });
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1] + 1) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    return merged
      .map(([start, end]) =>
        lines
          .slice(start, end + 1)
          .map((line, index) => `${String(start + index + 1).padStart(5, " ")}: ${line}`)
          .join("\n"),
      )
      .join("\n\n// … autre extrait …\n\n");
  };

  output.push(
    `# Contexte IA ciblé : ${feature}`,
    "",
    `Rubrique : ${config.description}.`,
    "",
    "Lire `AGENTS.md` et `CARTE_DU_PROJET.md` pour les règles générales. Les extraits de `App.tsx` et `styles.css` portent leurs numéros de ligne et ne remplacent pas les fichiers sources.",
  );
  for (const doc of ["AGENTS.md", "CARTE_DU_PROJET.md"]) {
    addFile(doc, readFileSync(join(root, doc), "utf8"));
  }
  for (const relativePath of config.files) {
    const absolutePath = join(root, relativePath);
    if (existsSync(absolutePath)) addFile(relativePath, readFileSync(absolutePath, "utf8"));
  }
  const appExcerpt = extractWindows("src/App.tsx", config.appTerms, 70);
  if (appExcerpt) addFile("src/App.tsx — extraits ciblés", appExcerpt);
  if (config.styleTerms.length > 0) {
    const styleDirectory = join(root, "src/styles");
    const styleFiles = existsSync(styleDirectory)
      ? readdirSync(styleDirectory)
          .filter((name) => name.endsWith(".css"))
          .sort()
          .map((name) => `src/styles/${name}`)
      : ["src/styles.css"];
    for (const styleFile of styleFiles) {
      const styleExcerpt = extractWindows(styleFile, config.styleTerms, 12);
      if (styleExcerpt) addFile(`${styleFile} — extraits ciblés`, styleExcerpt);
    }
  }

  const outputDirectory = join(root, ".ai-context");
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = join(outputDirectory, `${feature}.md`);
  writeFileSync(outputPath, `${output.join("\n\n")}\n`, "utf8");
  console.log(outputPath);
}
