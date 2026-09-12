import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const stylesDirectory = join(projectRoot, "src", "styles");
const splitStyles = (await readdir(stylesDirectory))
  .filter((name) => name.endsWith(".css"))
  .map((name) => join(stylesDirectory, name));
const files = [
  join(projectRoot, "src", "styles.css"),
  join(projectRoot, "src", "grandPalaisProgram.css"),
  ...splitStyles,
];

// Baseline du 29 août 2026, ajustée à la rubrique autonome des échanges de
// journées. La petite marge restante continue d'empêcher les surcharges
// dispersées lors des prochaines évolutions.
//
// Relevée de 30 lignes le 11 septembre 2026 pour la refonte visuelle : la
// hausse est de l'infrastructure — déclaration de la police d'affichage
// auto-hébergée et jetons de palette — et non une passe de surcharges.
//
// Abaissée le 12 septembre 2026 après la suppression des règles devenues
// sans objet : 100 familles de classes n'étaient plus posées nulle part
// dans le code. Le plafond suit la réalité mesurée plutôt que de garder la
// place libérée en réserve — sans quoi elle se remplirait d'elle-même.
//
// Abaissée à nouveau le même jour après le retrait des déclarations que la
// cascade écrasait plus loin. Les compteurs par famille tombent beaucoup
// parce qu'un même sélecteur était redéclaré dans plusieurs fichiers : ce
// sont ces redites qui rendaient chaque ajustement long à situer.
const limits = {
  totalLines: 14_200,
  importantDeclarations: 116,
  mediaQueries: 123,
  linesPerFile: 2_200,
  familyReferences: {
    topHeader: 230,
    pdfDownloadScreen: 20,
    todayOverview: 112,
  },
};

const measurements = await Promise.all(files.map(async (path) => {
  const source = await readFile(path, "utf8");
  return {
    path,
    source,
    lines: source.length === 0 ? 0 : source.split(/\r?\n/).length,
  };
}));
const totalLines = measurements.reduce((total, file) => total + file.lines, 0);
const source = measurements.map((file) => file.source).join("\n");
const sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
const importantDeclarations = (sourceWithoutComments.match(/!important\b/g) || []).length;
const mediaQueries = (sourceWithoutComments.match(/@media\b/g) || []).length;
const familyReferences = {
  topHeader: (sourceWithoutComments.match(/\.top-header(?:\b|-)/g) || []).length,
  pdfDownloadScreen: (sourceWithoutComments.match(/\.pdf-download-screen\b/g) || []).length,
  todayOverview: (sourceWithoutComments.match(/\.today-overview(?:\b|-)/g) || []).length,
};
const oversizedFiles = measurements.filter((file) => file.lines > limits.linesPerFile);
const failures = [];

function report(label, actual, maximum) {
  const ok = actual <= maximum;
  console.log(`${ok ? "OK" : "DÉPASSEMENT"} ${label}: ${actual} / ${maximum}`);
  if (!ok) failures.push(`${label} dépasse la limite de ${actual - maximum}`);
}

report("Lignes CSS", totalLines, limits.totalLines);
report("Déclarations !important", importantDeclarations, limits.importantDeclarations);
report("Media queries", mediaQueries, limits.mediaQueries);
report("Références de sélecteurs top-header", familyReferences.topHeader, limits.familyReferences.topHeader);
report("Références de sélecteurs pdf-download-screen", familyReferences.pdfDownloadScreen, limits.familyReferences.pdfDownloadScreen);
report("Références de sélecteurs today-overview", familyReferences.todayOverview, limits.familyReferences.todayOverview);
for (const file of oversizedFiles) {
  failures.push(`${basename(file.path)} contient ${file.lines} lignes (maximum ${limits.linesPerFile})`);
}
console.log(`OK Plus grand fichier: ${Math.max(...measurements.map((file) => file.lines))} / ${limits.linesPerFile} lignes`);

if (failures.length > 0) {
  console.error("\nComplexité CSS en hausse :");
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  console.error("Réutilisez ou simplifiez une règle existante avant d’ajouter une nouvelle surcharge.");
  process.exitCode = 1;
} else {
  console.log("\nLa complexité CSS reste dans la baseline validée.");
}
