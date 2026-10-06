#!/usr/bin/env node
/* Petit serveur statique pour les tests PWA : il relit chaque fichier à chaque
   demande (un test peut ainsi publier un nouveau service worker en réécrivant
   sw.js) et renvoie index.html pour les adresses de l'application.
   Usage : node scripts/serve-dist.mjs <dossier> <port> */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || 5181);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

async function fileFor(pathname) {
  const candidate = normalize(join(root, decodeURIComponent(pathname)));
  if (!candidate.startsWith(root)) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
    if (info.isDirectory()) {
      const index = join(candidate, "index.html");
      if ((await stat(index).catch(() => null))?.isFile()) return index;
    }
  } catch {
    // Absent : l'application gère ses propres adresses.
  }
  return extname(pathname) ? null : join(root, "index.html");
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url || "/", "http://localhost");
  const file = await fileFor(pathname);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  const body = await readFile(file);
  response.writeHead(200, {
    "content-type": TYPES[extname(file)] || "application/octet-stream",
    // Comme en ligne : le service worker et les pages sont toujours relus.
    "cache-control": /sw\.js$|\.html$/.test(file) ? "no-cache" : "public, max-age=31536000, immutable",
  });
  response.end(body);
}).listen(port, "127.0.0.1", () => console.log(`serve-dist : ${root} sur ${port}`));
