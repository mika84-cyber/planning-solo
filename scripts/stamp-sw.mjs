#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Le dossier construit : « dist » pour la publication, un autre pour les tests PWA.
const distDir = join(process.cwd(), process.argv[2] || "dist");
const swPath = join(distDir, "sw.js");
const formSwPath = join(distDir, "formulaire", "sw.js");

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath));
    else if (fullPath !== swPath) files.push(fullPath);
  }
  return files;
}

const files = collectFiles(distDir).sort();
const hash = createHash("sha256");
for (const file of files) {
  hash.update(relative(distDir, file));
  hash.update(readFileSync(file));
}
const digest = hash.digest("hex").slice(0, 12);

const swContent = readFileSync(swPath, "utf8");
const stamped = swContent.replace(
  /const CACHE = "[^"]*";/,
  `const CACHE = "planning-solo-${digest}";`,
);
if (stamped === swContent) {
  throw new Error(
    "stamp-sw: CACHE constant not found in dist/sw.js — check the pattern still matches public/sw.js",
  );
}
// Les fichiers téléchargés dès l'installation : tout le code et les styles,
// les polices, et les images légères (les grandes photos, la lecture OCR, les
// formulaires et PDF restent chargés à la demande).
const PRECACHE_IMAGE_LIMIT = 200 * 1024;
const precache = files
  .map((file) => ({ file, path: `/${relative(distDir, file).split("\\").join("/")}`, size: statSync(file).size }))
  .filter(({ path, size }) =>
    /^\/(assets|fonts|leave-tools)\//.test(path) ||
    (/^\/[^/]+\.(webp|png|svg)$/.test(path) && size <= PRECACHE_IMAGE_LIMIT))
  .filter(({ path }) => path !== "/sw.js");
const withPrecache = stamped.replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(precache.map(({ path }) => path))};`);
if (withPrecache === stamped) {
  throw new Error("stamp-sw: PRECACHE constant not found in sw.js — check the pattern still matches public/sw.js");
}
writeFileSync(swPath, withPrecache);
const precacheKb = Math.round(precache.reduce((sum, { size }) => sum + size, 0) / 1024);

const formSwContent = readFileSync(formSwPath, "utf8");
const stampedFormSw = formSwContent.replace(
  /var VERSION = '[^']*';/,
  `var VERSION = '${digest}';`,
);
if (stampedFormSw === formSwContent) {
  throw new Error(
    "stamp-sw: VERSION constant not found in dist/formulaire/sw.js",
  );
}
writeFileSync(formSwPath, stampedFormSw);
console.log(
  `stamp-sw: CACHE = planning-solo-${digest}; formulaire = demandes-${digest}; ${precache.length} fichiers préchargés (${precacheKb} Ko)`,
);
