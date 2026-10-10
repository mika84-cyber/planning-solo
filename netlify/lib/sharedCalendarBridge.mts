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

/** Vérifie la liaison avec le planning partagé sans rien envoyer : le
 *  secret est-il reconnu, et combien d'appareils recevraient une alerte.
 *  `null` si le service n'a pas répondu. */
export async function checkSharedNotificationChannel() {
  const response = await forwardNotificationRequest("POST", { action: "check" });
  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => null)) as
    | { devices?: number }
    | null;
  return { devices: Number(payload?.devices ?? 0) };
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
  /** Mika seul par défaut ; Agnès pour une note de Mika. */
  recipients?: Array<"mika" | "agnes">;
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

/** Un congé de Mika tel que le planning d'Agnès l'attend : tous les motifs,
 *  demi-journées comprises ; c'est son application qui décide comment les
 *  montrer. */
export function sharedPeriod(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const period = value as Record<string, unknown>;
  if (typeof period.id !== "string" || typeof period.from !== "string" || typeof period.to !== "string") return null;
  return {
    id: period.id,
    from: period.from,
    to: period.to,
    leaveType: String(period.leaveType || period.leave_type || ""),
    halfMoment: String(period.halfMoment || period.half_moment || ""),
    group: period.group,
  };
}

const PERIOD_ACTIONS = new Set(["save-period", "save-periods", "save-request", "delete-period"]);

function bodyOperations(body: Record<string, unknown>) {
  return body.action === "batch" && Array.isArray(body.operations)
    ? (body.operations as unknown[]).filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [body];
}

/** Une écriture change-t-elle une période de congé ? Les périodes sont alors
 *  toutes renvoyées d'un bloc : un lot n'indique pas toujours l'identifiant
 *  donné par le serveur. */
export function touchesSharedPeriods(body: Record<string, unknown>) {
  return bodyOperations(body).some((operation) => PERIOD_ACTIONS.has(String(operation.action)));
}

/** Les écritures jour par jour à recopier : l'absence d'une journée, et la
 *  suppression d'une note d'Agnès demandée depuis ce site. Les notes de Mika
 *  passent par `mirrorMikaNoteChanges` ; la paie, les heures et le reste ne
 *  quittent jamais ce site. */
export function sharedOperations(body: Record<string, unknown>): Record<string, unknown>[] {
  return bodyOperations(body).flatMap((operation): Record<string, unknown>[] => {
    const action = String(operation.action || "");
    if (action === "delete-shared-partner-note")
      return [{ action: "bridge-delete-agnes-note", groupId: operation.groupId, date: operation.date }];
    if ((action === "save-entry" || action === "save-leaves") && typeof operation.date === "string")
      return [{ action: "bridge-set-mika-away-day", date: operation.date, away: operation.leave === true }];
    return [];
  });
}

export async function syncExistingSharedCalendar(
  enabled: boolean,
  entries: Array<Record<string, unknown>>,
  periods: Array<Record<string, unknown>>,
) {
  if (!enabled) return "disabled" as const;
  const notes = entries
    .filter((entry) => typeof entry.date === "string" && typeof entry.note_text === "string" && entry.note_text.trim())
    .map((entry) => ({ date: entry.date, text: entry.note_text, color: entry.note_color }));
  const awayDates = entries
    .filter((entry) => typeof entry.date === "string" && entry.leave === true)
    .map((entry) => entry.date);
  const awayPeriods = periods.map(sharedPeriod).filter(Boolean);
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

/** Recopie sur le planning d'Agnès les notes de Mika qui viennent de changer,
 *  telles que les a relevées la comparaison avant/après l'écriture. */
export async function mirrorMikaNoteChanges(
  changes: Array<{ kind: "added" | "updated" | "deleted"; from: string; to: string; text: string }>,
) {
  try {
    for (const change of changes) {
      const response = await bridgeFetch(change.kind === "deleted"
        ? { action: "bridge-delete-mika-note", from: change.from, to: change.to }
        : { action: "bridge-save-mika-note", from: change.from, to: change.to, noteText: change.text });
      if (response && !response.ok) throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("Note non recopiée chez Agnès", error);
  }
}

export async function mirrorSharedCalendarAction(
  enabled: boolean,
  body: Record<string, unknown>,
  /** Les périodes de congé enregistrées, relues après l'écriture. */
  readPeriods?: () => Promise<Array<Record<string, unknown>>>,
) {
  if (!enabled) return "disabled" as const;
  const operations = sharedOperations(body);
  const periodsChanged = Boolean(readPeriods) && touchesSharedPeriods(body);
  if (!operations.length && !periodsChanged) return "ignored" as const;
  try {
    for (const operation of operations) {
      const response = await bridgeFetch(operation);
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
    }
    if (periodsChanged && readPeriods) {
      const response = await bridgeFetch({
        action: "bridge-sync-mika-calendar",
        awayDates: [],
        awayPeriods: (await readPeriods()).map(sharedPeriod).filter(Boolean),
      });
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
    }
    return "shared" as const;
  } catch (error) {
    console.error("Synchronisation vers Agnès impossible", error);
    return "unavailable" as const;
  }
}
