// Compacte les fichiers du formulaire autonome (/formulaire), que Vite copie
// tels quels depuis public/ : commentaires et espaces retirés, syntaxe
// simplifiée. Dans les modules (app.js et ce qu'il importe), les noms internes
// sont aussi raccourcis ; sheets.js et device.js, scripts classiques, gardent
// les leurs : ils définissent des variables globales lues par app.js.
// Le moteur PDF, déjà compacté, et le service worker sont laissés tels quels.
// À lancer après `vite build` et avant `stamp-sw.mjs`, qui calcule les
// empreintes du cache à partir des fichiers finaux.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { minifySync } from "rolldown/utils";
import { transform } from "lightningcss";

const directory = join(process.argv[2] || "dist", "formulaire");
const SKIP = new Set(["pdf-engine.js", "sw.js"]);
const MODULE_SYNTAX = /^\s*(?:import|export)\s/m;
let before = 0;
let after = 0;

for (const name of await readdir(directory)) {
  if (SKIP.has(name)) continue;
  const path = join(directory, name);
  if (name.endsWith(".js")) {
    const source = await readFile(path, "utf8");
    const isModule = MODULE_SYNTAX.test(source);
    const result = minifySync(name, source, {
      module: isModule,
      compress: true,
      mangle: isModule ? { toplevel: true } : false,
    });
    if (result.errors?.length) throw new Error(`${name} : ${result.errors.map((error) => error.message).join(" ; ")}`);
    before += Buffer.byteLength(source);
    after += Buffer.byteLength(result.code);
    await writeFile(path, result.code);
  } else if (name.endsWith(".css")) {
    const source = await readFile(path);
    const { code } = transform({ filename: name, code: source, minify: true });
    before += source.length;
    after += code.length;
    await writeFile(path, code);
  }
}

console.log(`formulaire compacté : ${(before / 1024).toFixed(1)} → ${(after / 1024).toFixed(1)} Kio`);
