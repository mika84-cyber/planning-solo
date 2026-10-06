import { isValidDateKey } from "../calendarValidation.mts";
import { calculateRegulatoryMecenatVacation } from "../../../src/mecenatRegulation.ts";
import { nextPayPeriod } from "../../../src/overtime.ts";
import { json, validId, type MecenatEntry } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSaveMecenat(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const requestedId = typeof body.id === "string" ? body.id : "";
  const id = requestedId || crypto.randomUUID();
  const date = typeof body.date === "string" ? body.date : "";
  const start = typeof body.start === "string" ? body.start.slice(0, 5) : "";
  const end = typeof body.end === "string" ? body.end.slice(0, 5) : "";
  // Un mécénat se paie le mois suivant ; il peut aussi l'être dès le mois où
  // il a été fait, lorsqu'un bulletin vérifié le montre. Aucun autre mois.
  const payPeriod = nextPayPeriod(date);
  const performedYear = Number(date.slice(0, 4));
  const performedMonth = Number(date.slice(5, 7)) - 1;
  const paidEarly = body.payYear === performedYear && body.payMonth === performedMonth;
  const payYear = paidEarly ? performedYear : payPeriod.year;
  const payMonth = paidEarly ? performedMonth : payPeriod.month;
  const calculation = calculateRegulatoryMecenatVacation(start, end);
  if (
    !validId(id) ||
    !isValidDateKey(date) ||
    !calculation
  )
    return json({ error: "Déclaration de mécénat invalide" }, 400);
  const entry: MecenatEntry = {
    id,
    date,
    start,
    end,
    day_minutes: calculation.dayMinutes,
    night_minutes: calculation.nightMinutes,
    gross_amount_cents: calculation.grossAmountCents,
    pay_year: payYear,
    pay_month: payMonth,
    updated_at: new Date().toISOString(),
  };
  await store.setJSON(scopedKey(`mecenat/${id}`), entry);
  return json({ ok: true, mecenat_entry: entry });
}
