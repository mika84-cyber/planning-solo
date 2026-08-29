import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DIST_DIR = new URL("../dist/", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_DIR);
const KIB = 1024;

// Ces budgets laissent une petite marge au-dessus de la version validée.
// Toute hausse plus importante doit être justifiée et revue explicitement.
const budgets = {
  // Les rubriques principales sont incluses dès l’ouverture pour éviter tout
  // écran de chargement pendant la navigation. Ce plafond garde environ 4 %
  // de marge au-dessus de la version statique validée.
  entryJavaScript: { raw: 590 * KIB, gzip: 170 * KIB },
  // Inclut aussi le moteur PDF autonome du formulaire, volontairement différé.
  largestSecondaryJavaScript: { raw: 900 * KIB, gzip: 330 * KIB },
  totalJavaScript: { raw: 2_500 * KIB, gzip: 790 * KIB },
  mainCss: { raw: 300 * KIB, gzip: 55 * KIB },
  // Inclut le CSS autonome de /formulaire en plus du CSS React principal.
  totalCss: { raw: 340 * KIB, gzip: 65 * KIB },
  payslipSuccessEffect: 3_500 * KIB,
  payslipWarningEffect: 2_500 * KIB,
};

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : path;
    }),
  );
  return nested.flat();
}

function describeBytes(bytes) {
  return `${(bytes / KIB).toFixed(1)} Kio`;
}

function check(label, actual, maximum, failures) {
  const status = actual <= maximum ? "OK" : "DÉPASSEMENT";
  console.log(`${status.padEnd(11)} ${label}: ${describeBytes(actual)} / ${describeBytes(maximum)}`);
  if (actual > maximum) failures.push(`${label} dépasse de ${describeBytes(actual - maximum)}`);
}

const indexPath = new URL("index.html", DIST_DIR);
const index = await readFile(indexPath, "utf8").catch(() => {
  throw new Error("Le dossier dist est absent. Exécutez d’abord npm run build.");
});
const allFiles = await filesUnder(DIST_PATH);
const jsFiles = allFiles.filter((file) => file.endsWith(".js"));
const cssFiles = allFiles.filter((file) => file.endsWith(".css"));

const entryMatch = index.match(/<script[^>]+src="([^"]+\.js)"/);
const mainCssMatch = index.match(/<link[^>]+href="([^"]+\.css)"/);
if (!entryMatch || !mainCssMatch) {
  throw new Error("Impossible d’identifier les ressources principales dans dist/index.html.");
}

const fromDist = (assetPath) => join(DIST_PATH, assetPath.replace(/^\//, ""));
const entryPath = fromDist(entryMatch[1]);
const mainCssPath = fromDist(mainCssMatch[1]);

async function measure(path) {
  const source = await readFile(path);
  return { raw: (await stat(path)).size, gzip: gzipSync(source, { level: 9 }).length };
}

const [entry, mainCss, jsMeasures, cssMeasures] = await Promise.all([
  measure(entryPath),
  measure(mainCssPath),
  Promise.all(jsFiles.map(async (path) => ({ path, ...(await measure(path)) }))),
  Promise.all(cssFiles.map(async (path) => ({ path, ...(await measure(path)) }))),
]);
const lazyJs = jsMeasures.filter(({ path }) => path !== entryPath);
const largestLazy = lazyJs.sort((left, right) => right.raw - left.raw)[0] ?? { raw: 0, gzip: 0, path: "" };
const totalJs = jsMeasures.reduce((sum, file) => ({ raw: sum.raw + file.raw, gzip: sum.gzip + file.gzip }), { raw: 0, gzip: 0 });
const totalCss = cssMeasures.reduce((sum, file) => ({ raw: sum.raw + file.raw, gzip: sum.gzip + file.gzip }), { raw: 0, gzip: 0 });
const [payslipSuccessEffect, payslipWarningEffect] = await Promise.all([
  stat(join(DIST_PATH, "payslip-success-money-fast.webp")),
  stat(join(DIST_PATH, "payslip-warning-lightning.mp4")),
]);
const failures = [];

console.log(`Entrée JS : ${relative(DIST_PATH, entryPath)}`);
console.log(`Plus gros module différé : ${relative(DIST_PATH, largestLazy.path)}`);
check("JS initial brut", entry.raw, budgets.entryJavaScript.raw, failures);
check("JS initial gzip", entry.gzip, budgets.entryJavaScript.gzip, failures);
check("Plus gros JS secondaire brut", largestLazy.raw, budgets.largestSecondaryJavaScript.raw, failures);
check("Plus gros JS secondaire gzip", largestLazy.gzip, budgets.largestSecondaryJavaScript.gzip, failures);
check("Total JS brut", totalJs.raw, budgets.totalJavaScript.raw, failures);
check("Total JS gzip", totalJs.gzip, budgets.totalJavaScript.gzip, failures);
check("CSS principal brut", mainCss.raw, budgets.mainCss.raw, failures);
check("CSS principal gzip", mainCss.gzip, budgets.mainCss.gzip, failures);
check("Total CSS brut", totalCss.raw, budgets.totalCss.raw, failures);
check("Total CSS gzip", totalCss.gzip, budgets.totalCss.gzip, failures);
check(
  "Animation paie conforme",
  payslipSuccessEffect.size,
  budgets.payslipSuccessEffect,
  failures,
);
check(
  "Animation paie à vérifier",
  payslipWarningEffect.size,
  budgets.payslipWarningEffect,
  failures,
);

if (failures.length > 0) {
  console.error("\nBudget de production dépassé :");
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exitCode = 1;
} else {
  console.log("\nTous les budgets de production sont respectés.");
}
