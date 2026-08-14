#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const distDir = join(process.cwd(), "dist");
const swPath = join(distDir, "sw.js");

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
writeFileSync(swPath, stamped);
console.log(`stamp-sw: CACHE = planning-solo-${digest}`);
