const DEFAULT_SHARED_API =
  "https://planning-partage-mika-agnes.netlify.app/api/calendar";
const MIKA_EMAIL_HASH =
  "b40d617ac12cfbfb4b5b3cc64f1b6c25fbbbd6119e10b6e1acc47f2bdbc1c558";

type SharedSnapshot = {
  status: "connected" | "disabled" | "unavailable";
  entries: unknown[];
  periods: unknown[];
};

function environment(name: string) {
  return (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(key: string): string | undefined } };
  }).Netlify?.env?.get(name);
}

function bridgeConfig() {
  return {
    url: environment("PLANNING_SHARED_API_URL") || DEFAULT_SHARED_API,
    secret: environment("PLANNING_SHARED_BRIDGE_SECRET") || "",
  };
}

export async function isMikaSharingAccount(email: string) {
  const normalized = email.trim().toLowerCase();
  const configuredEmail = environment("PLANNING_SHARED_OWNER_EMAIL")
    ?.trim()
    .toLowerCase();
  if (configuredEmail) return normalized === configuredEmail;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return hash === MIKA_EMAIL_HASH;
}

async function bridgeFetch(body?: Record<string, unknown>) {
  const { url, secret } = bridgeConfig();
  if (!secret) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    return await fetch(`${url}?bridge=planning-solo`, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        "x-planning-bridge": secret,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Le navigateur de Mika reste sur l’origine Planning Solo. Son abonnement
 * push est toutefois conservé par le planning partagé, qui possède déjà la
 * clé VAPID et distribue les rappels aux deux comptes. */
export async function forwardNotificationRequest(
  method: string,
  body?: Record<string, unknown> | null,
) {
  const { url, secret } = bridgeConfig();
  if (!secret) return null;
  const target = new URL(url);
  target.pathname = "/api/notifications";
  target.search = "bridge=planning-solo";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    return await fetch(target, {
      method,
      headers: {
        "content-type": "application/json",
        "x-planning-bridge": secret,
      },
      body: method === "POST" ? JSON.stringify(body || {}) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    console.error("Service de notifications partagé indisponible", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Prévient le téléphone de Mika. Les abonnements vivent sur le planning
 *  partagé : on lui demande d'envoyer, en s'annonçant avec le secret de
 *  liaison. Renvoie faux si le service n'a pas confirmé — l'appelant garde
 *  alors son autre moyen d'alerte. */
export async function sendSharedPlanningNotification(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  const response = await forwardNotificationRequest("POST", {
    action: "notify",
    ...payload,
  });
  return Boolean(response?.ok);
}

export async function readAgnesSharedCalendar(
  enabled: boolean,
): Promise<SharedSnapshot> {
  if (!enabled || !bridgeConfig().secret)
    return { status: "disabled", entries: [], periods: [] };
  try {
    const response = await bridgeFetch();
    if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
    const payload = (await response.json()) as {
      entries?: unknown[];
      periods?: unknown[];
    };
    return {
      status: "connected",
      entries: Array.isArray(payload.entries) ? payload.entries : [],
      periods: Array.isArray(payload.periods) ? payload.periods : [],
    };
  } catch (error) {
    console.error("Partage Agnès indisponible", error);
    return { status: "unavailable", entries: [], periods: [] };
  }
}

function periodOperation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const period = value as Record<string, unknown>;
  const leaveType = String(period.leaveType || period.leave_type || "");
  // Une demi-journée ne rend pas la personne absente toute la journée. Tous
  // les autres motifs sont volontairement masqués à l'application partenaire.
  if (leaveType === "half") return null;
  return {
    action: "bridge-save-mika-away-period",
    id: period.id,
    from: period.from,
    to: period.to,
  };
}

/** Convertit uniquement les écritures partageables. La paie, les maladies,
 * grèves, accidents et autres données privées ne quittent jamais ce site. */
export function sharedOperations(
  body: Record<string, unknown>,
  result?: Record<string, unknown>,
): Record<string, unknown>[] {
  const action = typeof body.action === "string" ? body.action : "";
  if (action === "save-note-period")
    return [{
      action: "bridge-save-mika-note",
      from: body.from,
      to: body.to,
      noteText: body.noteText,
      noteColor: body.noteColor,
      groupId: body.groupId,
    }];
  if (action === "delete-note-period")
    return [{ action: "bridge-delete-mika-note", groupId: body.groupId, date: body.date }];
  if (action === "delete-shared-partner-note")
    return [{ action: "bridge-delete-agnes-note", groupId: body.groupId, date: body.date }];
  if (action === "save-entry" && typeof body.date === "string") {
    const operations: Record<string, unknown>[] = [
      { action: "bridge-set-mika-away-day", date: body.date, away: body.leave === true },
    ];
    operations.push(
      typeof body.noteText === "string" && body.noteText.trim()
        ? {
          action: "bridge-save-mika-note",
          from: body.date,
          to: body.date,
          noteText: body.noteText,
          noteColor: body.noteColor,
        }
        : { action: "bridge-delete-mika-note", date: body.date },
    );
    return operations;
  }
  if (action === "save-period") {
    const operation = periodOperation(result?.period || body);
    return operation ? [operation] : [];
  }
  if (action === "save-periods" || action === "save-request") {
    const operations: Record<string, unknown>[] = [];
    for (const period of Array.isArray(result?.periods) ? result.periods : []) {
      const operation = periodOperation(period);
      if (operation) operations.push(operation);
    }
    return operations;
  }
  if (action === "delete-period" && typeof body.id === "string")
    return [{ action: "bridge-delete-mika-away-period", id: body.id }];
  if (action === "batch")
    return (Array.isArray(body.operations) ? body.operations : []).flatMap((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? sharedOperations(item as Record<string, unknown>)
        : [],
    );
  return [];
}

export async function syncExistingSharedCalendar(
  enabled: boolean,
  entries: Array<Record<string, unknown>>,
  periods: Array<Record<string, unknown>>,
) {
  if (!enabled) return "disabled" as const;
  const notes = entries
    .filter((entry) => typeof entry.date === "string" && typeof entry.note_text === "string" && entry.note_text.trim())
    .map((entry) => ({
      date: entry.date,
      text: entry.note_text,
      color: entry.note_color,
      updatedAt: entry.note_updated_at,
      groupId: entry.note_group_id,
    }));
  const awayDates = entries
    .filter((entry) => typeof entry.date === "string" && entry.leave === true)
    .map((entry) => entry.date);
  const awayPeriods = periods.map(periodOperation).filter(Boolean).map((operation) => ({
    id: operation!.id,
    from: operation!.from,
    to: operation!.to,
  }));
  try {
    const response = await bridgeFetch({
      action: "bridge-sync-mika-calendar",
      notes,
      awayDates,
      awayPeriods,
    });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
    return "shared" as const;
  } catch (error) {
    console.error("Reprise du calendrier partagé impossible", error);
    return "unavailable" as const;
  }
}

export async function mirrorSharedCalendarAction(
  enabled: boolean,
  body: Record<string, unknown>,
  result?: Record<string, unknown>,
) {
  if (!enabled) return "disabled" as const;
  const operations = sharedOperations(body, result);
  if (!operations.length) return "ignored" as const;
  try {
    for (const operation of operations) {
      const response = await bridgeFetch(operation);
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
    }
    return "shared" as const;
  } catch (error) {
    console.error("Synchronisation vers Agnès impossible", error);
    return "unavailable" as const;
  }
}
