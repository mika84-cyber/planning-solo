import { describe, expect, it } from "vitest";
import { workTimeHistoryItems } from "./LeaveManagementPage";

describe("historique des heures et récupérations", () => {
  it("réunit les origines dans l’ordre chronologique décroissant", () => {
    const items = workTimeHistoryItems(
      [
        { id: "gain", date: "2026-09-01", minutes: 60, dayMinutes: 60, nightMinutes: 0, disposition: "recovery", inputMode: "duration", updatedAt: "" },
        { id: "paid", date: "2026-09-04", minutes: 90, dayMinutes: 90, nightMinutes: 0, disposition: "paid", inputMode: "duration", updatedAt: "" },
      ],
      [{ id: "holiday", date: "2026-09-03", minutes: 495, dayMinutes: 495, nightMinutes: 0, disposition: "recovery", inputMode: "duration", updatedAt: "" }],
      [{ id: "use", date: "2026-09-02", minutes: 120, updatedAt: "" }],
    );
    expect(items.map((item) => item.kind)).toEqual(["paid", "holiday", "use", "gain"]);
  });
});
