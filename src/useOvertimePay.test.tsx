import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OvertimeEntry } from "./overtime";
import { useOvertimePay } from "./useOvertimePay";
import type { OvertimeDraft } from "./useWorkTimeUiState";

const paid = (id: string, date: string, start: string, end: string, minutes: number): OvertimeEntry => ({
  id, date, minutes, dayMinutes: minutes, nightMinutes: 0, disposition: "paid", inputMode: "range", start, end, updatedAt: "",
});

function Probe({ entries, draft }: { entries: OvertimeEntry[]; draft: OvertimeDraft }) {
  const { overtimeForPayMonth, overtimePayPreview, overtimeEarlyCandidates } = useOvertimePay({
    overtimeEntries: entries,
    payProfiles: { "2026": { baseSalary: 2_000, residenceAllowance: 60 } as never },
    formProfile: null,
    workQuota: "full",
    group: 2,
    payView: new Date(2026, 10, 1, 12),
    overtimeDraft: draft,
  });
  return <pre>{JSON.stringify({
    month: Math.round(overtimeForPayMonth.amount * 100),
    minutes: overtimeForPayMonth.totalMinutes,
    preview: overtimePayPreview && { ...overtimePayPreview, amount: Math.round(overtimePayPreview.amount * 100) },
    early: overtimeEarlyCandidates(2026, 9).map((item) => [item.entry.id, item.cents]),
  })}</pre>;
}

const read = (html: string) => JSON.parse(html.replace(/^<pre>|<\/pre>$/g, "").replaceAll("&quot;", "\""));
const empty: OvertimeDraft = { date: "", start: "", end: "", disposition: "" };

describe("paiement des heures supplémentaires (hook)", () => {
  // Base horaire : (2 000 + 60) × 12 / 1 820 = 13,58 €/h ; 2 h à 1,25 = 33,96 €.
  it("paie en novembre les heures d'octobre et annonce ce qu'elles rapportent", () => {
    const entries = [paid("oct", "2026-10-12", "18:00", "20:00", 120)];
    const result = read(renderToStaticMarkup(<Probe entries={entries} draft={empty} />));
    expect(result.minutes).toBe(120);
    expect(result.month).toBe(3396);
    expect(result.preview).toBeNull();
    expect(result.early).toEqual([["oct", 3396]]);
  });

  it("annonce le montant des heures à payer en cours de saisie, sans les compter deux fois", () => {
    const draft: OvertimeDraft = { date: "2026-10-14", start: "18:00", end: "20:00", disposition: "paid" };
    const result = read(renderToStaticMarkup(<Probe entries={[]} draft={draft} />));
    expect(result.month).toBe(0);
    expect(result.preview).toMatchObject({ ready: true, amount: 3396, payYear: 2026, payMonth: 10, cappedMinutes: 0, partTime: false });
  });
});
