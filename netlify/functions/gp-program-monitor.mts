import { runGrandPalaisCheck } from "../lib/grandPalaisCheck.mts";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8" } });
}

export default async function monitorGrandPalaisProgram() {
  // Netlify schedules in UTC: only one of the two daily slots is midnight in Paris.
  // Un contrôle à une autre heure se lance à la main depuis Programmation GP.
  const parisHour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find(part => part.type === "hour")?.value;
  if (parisHour !== "00") return json({ ok: true, skipped: true });
  return json(await runGrandPalaisCheck());
}

export const config = { schedule: "5 22,23 * * *" };
