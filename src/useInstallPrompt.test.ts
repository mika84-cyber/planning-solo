import { describe, expect, it } from "vitest";
import {
  canEnableInstallation,
  isDemoInstallationLink,
  isNetlifyDeployPreview,
} from "./useInstallPrompt";

describe("isNetlifyDeployPreview", () => {
  it("bloque les adresses de prévisualisation Netlify du planning", () => {
    expect(
      isNetlifyDeployPreview("deploy-preview-2--planning-solo.netlify.app"),
    ).toBe(true);
  });

  it("autorise l'adresse de production", () => {
    expect(isNetlifyDeployPreview("planning-solo.netlify.app")).toBe(false);
  });

  it("n'affecte pas les autres sites", () => {
    expect(isNetlifyDeployPreview("example.netlify.app")).toBe(false);
  });

  it("bloque tout lien portant le mode démo", () => {
    expect(isDemoInstallationLink("planning-solo.netlify.app", "?demo=1")).toBe(true);
    expect(isDemoInstallationLink("192.168.1.16", "?foo=1&demo=1")).toBe(true);
  });

  it("autorise uniquement le lien officiel sans mode démo", () => {
    expect(isDemoInstallationLink("planning-solo.netlify.app", "")).toBe(false);
  });

  it("attend la connexion à un compte activé avant d'autoriser l'installation", () => {
    expect(canEnableInstallation("guest", false, "planning-solo.netlify.app", "")).toBe(false);
    expect(canEnableInstallation("invite", false, "planning-solo.netlify.app", "")).toBe(false);
    expect(canEnableInstallation("ready", false, "planning-solo.netlify.app", "")).toBe(true);
    expect(canEnableInstallation("ready", true, "planning-solo.netlify.app", "?demo=1")).toBe(false);
  });
});
