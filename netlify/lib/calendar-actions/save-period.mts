import { isValidDateKey } from "../calendarValidation.mts";
import { json, rangeSpan, validId, type HalfMoment, type LeavePeriod, type LeaveType } from "../calendarShared.mts";
import type { CalendarActionContext } from "./context.mts";
export async function handleSavePeriod(
  context: CalendarActionContext,
): Promise<Response> {
  const {
    body,
    store,
    scopedKey,
  } = context;
  const from = typeof body.from === "string" ? body.from : "";
  const to = typeof body.to === "string" ? body.to : "";
  const leaveType: LeaveType =
    body.leaveType === "annual" ||
    body.leaveType === "rtt" ||
    body.leaveType === "fraction" ||
    body.leaveType === "half" ||
    body.leaveType === "recovery" ||
    body.leaveType === "sick" ||
    body.leaveType === "strike" ||
    body.leaveType === "cet" ||
    body.leaveType === "other" ||
    body.leaveType === "childcare" ||
    body.leaveType === "exceptional"
      ? body.leaveType
      : "";
  const halfMoment: HalfMoment =
    body.halfMoment === "morning" || body.halfMoment === "afternoon"
      ? body.halfMoment
      : "";
  const periodGroup = [1, 2, 3].includes(Number(body.group))
    ? Number(body.group)
    : undefined;
  const requestedId = typeof body.id === "string" ? body.id : "";
  if (!isValidDateKey(from) || !isValidDateKey(to) || to < from)
    return json({ error: "Période invalide" }, 400);
  const span = rangeSpan(from, to);
  if (span < 1 || span > 366)
    return json({ error: "Période trop longue" }, 400);
  if (requestedId && !validId(requestedId))
    return json({ error: "Identifiant invalide" }, 400);
  const id = requestedId || crypto.randomUUID();
  const previous = requestedId
    ? ((await store.get(scopedKey(`period/${id}`), {
        type: "json",
      })) as LeavePeriod | null)
    : null;
  if (
    typeof body.expectedUpdatedAt === "string" &&
    body.expectedUpdatedAt !== (previous?.updated_at || "")
  )
    return json(
      { error: "Cette période a été modifiée sur un autre appareil" },
      409,
    );
  const resolvedType: LeaveType = leaveType || previous?.leave_type || "";
  const period: LeavePeriod = {
    id,
    from,
    to,
    leave_type: resolvedType,
    // Le moment ne vaut que pour une demi-journée : passer la période à un
    // autre type l'efface plutôt que de le laisser traîner.
    half_moment:
      resolvedType === "half"
        ? halfMoment || previous?.half_moment || ""
        : "",
    group: periodGroup || previous?.group,
    updated_at: new Date().toISOString(),
  };
  await store.setJSON(scopedKey(`period/${id}`), period);
  return json({ ok: true, period });
}
