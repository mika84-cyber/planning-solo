// Compactage des fichiers du formulaire autonome : commentaires et espaces
// retirés, syntaxe simplifiée. Dans les modules (app.js et ce qu'il importe),
// les noms internes sont aussi raccourcis ; sheets.js et device.js, scripts
// classiques, gardent les leurs : ils définissent des variables globales lues
// par app.js. Le service worker est laissé tel quel.
// Partagé par `minify-standalone.mjs` (site principal) et `build-congecp.mjs`
// (site autonome Congé CP).
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { minifySync } from "rolldown/utils";
import { transform } from "lightningcss";

// Le service worker du formulaire garde son texte : ses empreintes de cache
// sont calculées ensuite. Le moteur PDF (jsPDF, déjà compacté) est repassé
// sans renommage : sa syntaxe simplifiée gagne encore 8 Kio compressés.
const SKIP = new Set(["sw.js"]);
const MODULE_SYNTAX = /^\s*(?:import|export)\s/m;

/** Compacte sur place les scripts et styles du dossier donné. */
export async function compactStandalone(directory) {
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
  return { before, after };
}
