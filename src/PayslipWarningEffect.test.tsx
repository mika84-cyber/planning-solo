import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayslipWarningEffect } from "./PayslipWarningEffect";

describe("animation de bulletin avec écart", () => {
  it("prépare une vidéo silencieuse et intégrée au plein écran", () => {
    const html = renderToStaticMarkup(<PayslipWarningEffect />);
    expect(html).toContain('class="payslip-warning-effect"');
    expect(html).toContain('src="/payslip-warning-lightning.mp4"');
    expect(html).toContain("Écart détecté dans le bulletin");
    expect(html).toContain("Une information est à vérifier");
    expect(html).toContain("autoPlay");
    expect(html).toContain("muted");
    expect(html).toContain("playsInline");
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('aria-hidden="true"');
  });
});
