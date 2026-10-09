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
  //
  // Relevé de 180 à 181 Kio le 11 septembre 2026, pour 447 octets de
  // dépassement — 0,24 %. La hausse paie le choix entre un solde déjà calculé
  // et des heures à majorer, ajouté après qu'une double majoration a faussé
  // le compteur d'une collègue. Le brut, lui, reste dans son plafond d'origine
  // (620 sur 625 Kio) : c'est le signe qu'il n'y a pas de code mort derrière
  // cette hausse, seulement de l'interface. La prochaine évolution du
  // chargement initial devra se financer par un allègement, pas par un
  // troisième relèvement.
  entryJavaScript: { raw: 625 * KIB, gzip: 181 * KIB },
  // Inclut aussi le moteur PDF autonome du formulaire, volontairement différé.
  largestSecondaryJavaScript: { raw: 900 * KIB, gzip: 330 * KIB },
  // Relevé le 11 septembre 2026. La croissance vient des rubriques ajoutées
  // depuis la dernière mesure — outils d'administration, gestion des
  // documents, partage entre collègues — et de la refonte visuelle. Le
  // chargement initial, lui, reste dans son plafond : c'est lui qui décide de
  // la vitesse d'ouverture, le reste n'arrive qu'à la demande.
  // Relevé le 18 septembre 2026 : mode sombre de toute l'application, vue
  // semaine des collègues et choix des destinataires d'un message collectif.
  // Le chargement initial, lui, reste sous son plafond et a même diminué —
  // la conversion sombre et les formulaires CET ne sont chargés qu'à l'usage.
  // Relevé à nouveau le 18 septembre 2026 : retenues maladie et grève sur la
  // paie qui les porte, demi-journées de RTT et de fractionnement. Le
  // contrôle du bulletin a quitté le démarrage pour se charger avec Ma paie,
  // ce qui ramène le chargement initial sous son plafond.
  // Abaissé le 25 septembre 2026, de 2 690 / 850 Kio à 2 350 / 760 Kio. Le
  // total gzip dépassait de 0,5 Kio après la programmation GP et l'accueil ;
  // plutôt que de relever encore, html2canvas, DOMPurify et canvg ne sont
  // plus livrés (voir src/jspdfUnusedModule.ts) : ces modules optionnels de
  // jsPDF, jamais téléchargés, pesaient 103 Kio compressés. Mesure validée :
  // 2 309,5 / 747,7 Kio. Le chargement initial ne change pas.
  // Relevé le 30 septembre 2026 de 2 350 / 760 à 2 360 / 763 Kio : historique
  // de la messagerie, poste du jour et demi-journées d'ASA et de Divers
  // (760,1 Kio mesurés). Le chargement initial reste à 178,5 / 181 Kio.
  // Relevé le 1er octobre 2026 de 763 à 765 Kio compressés : page d'ajout de
  // lignes de paie, prénoms des plannings partagés, nombre et description des
  // dossiers de formulaires et des annuaires de contacts, notes d'Agnès
  // listées jour par jour (763,04 Kio mesurés).
  // Relevé le 8 octobre 2026 de 765 à 771 Kio compressés, avec l'accord de
  // l'administrateur, après un allègement : la programmation GP et le CET
  // sont sortis du chargement initial (588,7 / 176 Kio, de nouveau sous leurs
  // plafonds) et le formulaire autonome est compacté à la construction
  // (scripts/minify-standalone.mjs, 240 → 170 Kio). Le reste (768,9 Kio
  // mesurés) tient aux rubriques ajoutées depuis le 1er octobre : historique
  // des mécénats, règles des congés, veille du site, signature partagée.
  // Relevé le 9 octobre 2026 de 771 à 775 Kio compressés, avec l'accord de
  // l'administrateur : Ma paie en bulletin simplifié (frise du brut, lignes
  // détaillées, totaux du calcul expliqués), alors même que l'ancien tableau
  // de bord et « Affiner mes estimations » ont été retirés (773,8 mesurés).
  totalJavaScript: { raw: 2_360 * KIB, gzip: 775 * KIB },
  // Le moteur OCR est chargé uniquement lorsque l'utilisateur choisit une
  // photo. Trois noyaux sont livrés pour laisser le navigateur sélectionner
  // la variante compatible ; un seul est téléchargé sur l'appareil.
  ocrAssets: { raw: 13_000 * KIB, gzip: 5_200 * KIB },
  // Inclut désormais la navigation complète et les nouveaux états de gestion
  // des documents, avec une marge limitée au-dessus de la version validée.
  // Relevé le 11 septembre 2026 avec la refonte visuelle. Le nombre de lignes
  // de CSS a lui baissé : la hausse tient aux nouvelles rubriques, pas à un
  // empilement de surcharges — c'est `check:css` qui surveille ce point.
  mainCss: { raw: 375 * KIB, gzip: 70 * KIB },
  // Inclut le CSS autonome de /formulaire ainsi que les pages différées de
  // partage des plannings et de messagerie ; elles n’alourdissent pas le CSS
  // initial et restent chargées uniquement à leur ouverture. Relevé à 480 Kio
  // le 26 septembre 2026 pour la fiche d'une journée en tuiles et le calcul
  // du fractionnement, après retrait des styles d'onglets devenus inutiles.
  // Relevé le 8 octobre 2026 à 525 / 97 Kio (519,5 / 95,7 mesurés), avec
  // l'accord de l'administrateur : le CSS du formulaire est désormais
  // compacté, mais les retouches successives ont empilé des règles. Un
  // nettoyage des surcharges est prévu à part ; il devra ramener ce total
  // sous 480 Kio plutôt que justifier un nouveau relèvement.
  // Relevé le 9 octobre 2026 à 529 / 99 Kio (528,6 / 98,3 mesurés), avec
  // l'accord de l'administrateur, pour Ma paie en bulletin simplifié — après
  // retrait d'environ 16 Ko de styles de l'ancien tableau de bord.
  totalCss: { raw: 529 * KIB, gzip: 99 * KIB },
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
const isOcrAsset = (path) => relative(DIST_PATH, path).split(/[\\/]/)[0] === "ocr";
const appJsMeasures = jsMeasures.filter(({ path }) => !isOcrAsset(path));
const ocrMeasures = await Promise.all(
  allFiles.filter(isOcrAsset).map(async (path) => ({ path, ...(await measure(path)) })),
);
const lazyJs = appJsMeasures.filter(({ path }) => path !== entryPath);
const largestLazy = lazyJs.sort((left, right) => right.raw - left.raw)[0] ?? { raw: 0, gzip: 0, path: "" };
const totalJs = appJsMeasures.reduce((sum, file) => ({ raw: sum.raw + file.raw, gzip: sum.gzip + file.gzip }), { raw: 0, gzip: 0 });
const totalOcr = ocrMeasures.reduce((sum, file) => ({ raw: sum.raw + file.raw, gzip: sum.gzip + file.gzip }), { raw: 0, gzip: 0 });
const totalCss = cssMeasures.reduce((sum, file) => ({ raw: sum.raw + file.raw, gzip: sum.gzip + file.gzip }), { raw: 0, gzip: 0 });
const failures = [];

console.log(`Entrée JS : ${relative(DIST_PATH, entryPath)}`);
console.log(`Plus gros module différé : ${relative(DIST_PATH, largestLazy.path)}`);
check("JS initial brut", entry.raw, budgets.entryJavaScript.raw, failures);
check("JS initial gzip", entry.gzip, budgets.entryJavaScript.gzip, failures);
check("Plus gros JS secondaire brut", largestLazy.raw, budgets.largestSecondaryJavaScript.raw, failures);
check("Plus gros JS secondaire gzip", largestLazy.gzip, budgets.largestSecondaryJavaScript.gzip, failures);
check("Total JS brut", totalJs.raw, budgets.totalJavaScript.raw, failures);
check("Total JS gzip", totalJs.gzip, budgets.totalJavaScript.gzip, failures);
check("Ressources OCR locales brutes", totalOcr.raw, budgets.ocrAssets.raw, failures);
check("Ressources OCR locales gzip", totalOcr.gzip, budgets.ocrAssets.gzip, failures);
check("CSS principal brut", mainCss.raw, budgets.mainCss.raw, failures);
check("CSS principal gzip", mainCss.gzip, budgets.mainCss.gzip, failures);
check("Total CSS brut", totalCss.raw, budgets.totalCss.raw, failures);
check("Total CSS gzip", totalCss.gzip, budgets.totalCss.gzip, failures);
if (failures.length > 0) {
  console.error("\nBudget de production dépassé :");
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exitCode = 1;
} else {
  console.log("\nTous les budgets de production sont respectés.");
}
