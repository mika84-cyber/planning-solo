import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mecenatsPaidEarly, type MecenatEntry } from "./mecenat";
import { isMecenatLabel, isOvertimeLabel } from "./payslip";
import { EarlyMecenatPayment, EarlyPaymentNotice } from "./PayslipVerificationCard";

const entry = (id: string, date: string, grossAmountCents: number): MecenatEntry => ({
  id, date, start: "19:00", end: "23:00", dayMinutes: 180, nightMinutes: 60,
  grossAmountCents, payYear: 2026, payMonth: 10, updatedAt: "",
});

describe("mécénat payé en avance sur le bulletin", () => {
  it("reconnaît les lignes de mécénat du bulletin", () => {
    expect(isMecenatLabel("Indemnité mécénat")).toBe(true);
    expect(isMecenatLabel("VACATIONS MECENAT")).toBe(true);
    expect(isMecenatLabel("IHTS 14 premières heures")).toBe(false);
  });

  it("propose de confirmer d'un geste le mécénat qui explique le surplus", () => {
    const early = mecenatsPaidEarly([entry("oct-1", "2026-10-05", 10_370)], 2026, 9, 10_370);
    const html = renderToStaticMarkup(<EarlyMecenatPayment early={early} nextMonthLabel="Novembre" onConfirm={vi.fn()} />);
    expect(html).toContain("Mécénat payé en avance");
    expect(html).toContain("au mécénat suivant, prévu sur la paie de Novembre");
    expect(html).toContain("19 h – 23 h");
    expect(html).toContain("Confirmer : déjà payé, retiré de Novembre");
    expect(html).not.toContain("Déjà payé</button>");
  });

  it("laisse choisir mécénat par mécénat quand le montant ne correspond pas", () => {
    const early = mecenatsPaidEarly([entry("oct-1", "2026-10-05", 10_370), entry("oct-2", "2026-10-25", 5_000)], 2026, 9, 7_000);
    const html = renderToStaticMarkup(<EarlyMecenatPayment early={early} nextMonthLabel="Novembre" onConfirm={vi.fn()} />);
    expect(html).toContain("Indiquez lesquels de ces mécénats");
    expect(html.match(/Déjà payé<\/button>/g)).toHaveLength(2);
  });

  it("dit la même chose pour des heures supplémentaires payées en avance", () => {
    const html = renderToStaticMarkup(
      <EarlyPaymentNotice
        kind="overtime"
        surplusCents={5_230}
        items={[{ id: "oct", label: "lun. 12 octobre · 18 h – 20 h · 2 h", cents: 5_230 }]}
        matchedIds={["oct"]}
        nextMonthLabel="novembre"
        onConfirm={vi.fn()}
      />,
    );
    expect(html).toContain("Heures supplémentaires payées en avance");
    expect(html).toContain("52,30");
    expect(html).toContain("à la déclaration suivante, prévue sur la paie de novembre");
    expect(html).toContain("Confirmer : déjà payée, retirée de novembre");
    expect(isOvertimeLabel("IHTS 14 premières heures")).toBe(true);
    expect(isOvertimeLabel("Indemnité mécénat")).toBe(false);
  });
});
