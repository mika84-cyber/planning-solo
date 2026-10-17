// Construit le site autonome « Congé CP » (congecp) à partir de
// `public/formulaire/`. C'est le même formulaire que `/formulaire/` sur
// Planning Solo, mais servi à la racine d'un site sans compte ni API : le
// retour vers l'application et la synchronisation de la signature y sont
// retirés. Le dossier produit, `dist-congecp/`, se dépose tel quel sur
// Netlify Drop ; `_headers` y rejoue les protections de `netlify.toml`.
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compactStandalone } from "./lib/compact-standalone.mjs";

const SOURCE = join("public", "formulaire");
const TARGET = "dist-congecp";
const ONLY_START = "<!-- planning-solo-only:début -->";
const ONLY_END = "<!-- planning-solo-only:fin -->";
const DECLARED_API = '<meta name="planning-api" content="same-origin">';
const STANDALONE_API = '<meta name="planning-api" content="none">';

/** Les feuilles attendues : la construction s'arrête si l'une manque. */
export const EXPECTED_SHEETS = ["conges", "recup", "echange", "ferie", "annul"];

/* Protections de `netlify.toml` rejouées pour un site déposé à la main, où il
   n'y a pas de configuration Netlify : le formulaire est servi à la racine, le
   service worker couvre donc tout le site. */
export const STANDALONE_HEADERS = `/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-Robots-Tag: noindex, nofollow, noarchive

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
  Service-Worker-Allowed: /

/app.webmanifest
  Content-Type: application/manifest+json

/pdf-engine.js
  Cache-Control: no-cache
`;

/** Retire de la page ce qui n'a de sens que servi par Planning Solo. */
export function adaptStandalonePage(html) {
  if (!html.includes(DECLARED_API))
    throw new Error(`index.html ne déclare plus ${DECLARED_API}`);
  if (!html.includes(ONLY_START) || !html.includes(ONLY_END))
    throw new Error(`index.html ne marque plus les blocs ${ONLY_START}`);
  let page = html.replaceAll(DECLARED_API, STANDALONE_API);
  for (;;) {
    const start = page.indexOf(ONLY_START);
    if (start < 0) break;
    const end = page.indexOf(ONLY_END, start);
    if (end < 0) throw new Error(`bloc ${ONLY_START} jamais refermé`);
    page = page.slice(0, start) + page.slice(end + ONLY_END.length);
  }
  return page;
}

/* Le cache du service worker porte l'empreinte du dossier construit, comme
   `stamp-sw.mjs` le fait pour Planning Solo : sans cela un nouveau dépôt
   laisserait les anciens fichiers en place sur les appareils qui ont déjà
   installé Congé CP, le service worker servant le cache d'abord. */
export function stampFormServiceWorker(source, digest) {
  const stamped = source.replace(/var VERSION = '[^']*';/, `var VERSION = '${digest}';`);
  if (stamped === source) throw new Error("sw.js ne déclare plus var VERSION");
  return stamped;
}

async function totalSize(directory) {
  let total = 0;
  for (const name of await readdir(directory)) total += (await stat(join(directory, name))).size;
  return total;
}

async function build() {
  const sheets = await readFile(join(SOURCE, "sheets.js"), "utf8");
  const missing = EXPECTED_SHEETS.filter((id) => !sheets.includes(`"id":"${id}"`));
  if (missing.length) throw new Error(`feuilles absentes de sheets.js : ${missing.join(", ")}`);

  await rm(TARGET, { recursive: true, force: true });
  await mkdir(TARGET, { recursive: true });
  await cp(SOURCE, TARGET, { recursive: true });
  await rm(join(TARGET, "README.md"), { force: true });

  const page = join(TARGET, "index.html");
  await writeFile(page, adaptStandalonePage(await readFile(page, "utf8")));
  await writeFile(join(TARGET, "_headers"), STANDALONE_HEADERS);
  await compactStandalone(TARGET);

  const hash = createHash("sha256");
  for (const name of (await readdir(TARGET)).sort()) {
    if (name === "sw.js") continue;
    hash.update(name);
    hash.update(await readFile(join(TARGET, name)));
  }
  const digest = hash.digest("hex").slice(0, 12);
  const serviceWorker = join(TARGET, "sw.js");
  await writeFile(serviceWorker, stampFormServiceWorker(await readFile(serviceWorker, "utf8"), digest));

  const size = await totalSize(TARGET);
  console.log(
    `Congé CP prêt dans ${TARGET}/ : ${EXPECTED_SHEETS.length} feuilles, ${(size / 1024 / 1024).toFixed(1)} Mio, cache demandes-${digest}.`,
  );
  console.log("Déposez ce dossier sur Netlify Drop pour mettre congecp à jour.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await build();
