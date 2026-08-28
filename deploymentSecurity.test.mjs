import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const netlify = readFileSync("netlify.toml", "utf8");

describe("protections du déploiement", () => {
  it("conserve les en-têtes de sécurité globaux", () => {
    expect(netlify).toContain('Content-Security-Policy = "default-src \'self\'');
    expect(netlify).toContain('Strict-Transport-Security = "max-age=31536000"');
    expect(netlify).toContain('X-Content-Type-Options = "nosniff"');
    expect(netlify).toContain('X-Frame-Options = "DENY"');
  });

  it("protège le formulaire et empêche la mise en cache de ses points d’entrée", () => {
    expect(netlify).toContain('for = "/formulaire/*"');
    expect(netlify).toContain('X-Robots-Tag = "noindex, nofollow, noarchive"');
    expect(netlify).toContain('for = "/formulaire/sw.js"');
    expect(netlify).toContain('Service-Worker-Allowed = "/formulaire/"');
    expect(netlify).toContain('for = "/formulaire/index.html"');
    expect(netlify).toContain('Cache-Control = "no-cache, no-store, must-revalidate"');
    expect(existsSync("public/formulaire/_headers")).toBe(false);
  });
});
