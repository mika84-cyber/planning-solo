// Compacte les fichiers du formulaire autonome (/formulaire), que Vite copie
// tels quels depuis public/. Le travail lui-même vit dans
// `lib/compact-standalone.mjs`, partagé avec la construction du site Congé CP.
// À lancer après `vite build` et avant `stamp-sw.mjs`, qui calcule les
// empreintes du cache à partir des fichiers finaux.
import { join } from "node:path";
import { compactStandalone } from "./lib/compact-standalone.mjs";

const directory = join(process.argv[2] || "dist", "formulaire");
const { before, after } = await compactStandalone(directory);

console.log(`formulaire compacté : ${(before / 1024).toFixed(1)} → ${(after / 1024).toFixed(1)} Kio`);
