import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayslipSuccessCelebration } from "./PayslipSuccessCelebration";

describe("animation de bulletin conforme", () => {
  it("utilise le GIF plein écran comme décoration non annoncée", () => {
    const html = renderToStaticMarkup(<PayslipSuccessCelebration />);
    expect(html).toContain('class="payslip-success-celebration"');
    expect(html).toContain('src="/payslip-success-money-fast.webp"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('alt=""');
  });
});
