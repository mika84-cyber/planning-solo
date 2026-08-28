import type {
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "../../src/grandPalaisProgramTypes.ts";

const OFFICIAL_ORIGIN = "https://www.grandpalais.fr";
const GRAND_PALAIS_FETCH_TIMEOUT_MS = 12_000;
const MAX_GRAND_PALAIS_HTML_BYTES = 3 * 1024 * 1024;

function officialGrandPalaisUrl(value: string, fallback = "") {
  try {
    const url = new URL(value, OFFICIAL_ORIGIN);
    return url.origin === OFFICIAL_ORIGIN && url.protocol === "https:"
      ? url.href.replace(/\/$/, "")
      : fallback;
  } catch {
    return fallback;
  }
}

async function limitedText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_GRAND_PALAIS_HTML_BYTES)
    throw new Error("Réponse Grand Palais trop volumineuse");
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_GRAND_PALAIS_HTML_BYTES)
      throw new Error("Réponse Grand Palais trop volumineuse");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > MAX_GRAND_PALAIS_HTML_BYTES) {
      await reader.cancel();
      throw new Error("Réponse Grand Palais trop volumineuse");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchGrandPalaisHtml(
  url: string,
  fetcher: typeof fetch,
  required = false,
) {
  const officialUrl = officialGrandPalaisUrl(url);
  if (!officialUrl) throw new Error("Adresse Grand Palais non autorisée");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAND_PALAIS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(officialUrl, {
      headers: { "user-agent": "Planning-Solo/1.0 programme monitor" },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (required)
        throw new Error(`Programme Grand Palais indisponible (${response.status})`);
      return null;
    }
    return await limitedText(response);
  } finally {
    clearTimeout(timeout);
  }
}

function stableId(value: string, length = 20) {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}${value.length.toString(36)}`
    .padEnd(length, "0").slice(0, length);
}

function runtimeEnv() {
  const netlify = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify;
  return {
    RESEND_API_KEY: netlify?.env?.get("RESEND_API_KEY"),
    PROGRAM_ADMIN_EMAIL: netlify?.env?.get("PROGRAM_ADMIN_EMAIL"),
    PROGRAM_ALERT_FROM: netlify?.env?.get("PROGRAM_ALERT_FROM"),
  };
}

export type GrandPalaisMonitorState = {
  lastCheckedAt?: string;
  lastKnown: Record<string, SharedGrandPalaisEvent>;
  missingCounts: Record<string, number>;
};

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return entities[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function cleanText(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

function normalizedMonth(value: string) {
  return FRENCH_MONTHS[value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()];
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return "";
  return date.toISOString().slice(0, 10);
}

function dateRange(first: string, last: string) {
  const dates: string[] = [];
  const current = new Date(`${first}T12:00:00Z`);
  const end = new Date(`${last}T12:00:00Z`);
  while (current <= end && dates.length < 62) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function closureDates(value: string, fallbackYear: number) {
  const dates: string[] = [];
  const range = value.match(/du\s+(\d{1,2})\s+([\p{L}]+)(?:\s+(\d{4}))?\s+au\s+(\d{1,2})\s+([\p{L}]+)(?:\s+(\d{4}))?/iu);
  if (range) {
    const endYear = Number(range[6] || range[3] || fallbackYear);
    const startMonth = normalizedMonth(range[2]);
    const endMonth = normalizedMonth(range[5]);
    const startYear = Number(range[3] || (startMonth > endMonth ? endYear - 1 : endYear));
    const first = isoDate(startYear, startMonth, Number(range[1]));
    const last = isoDate(endYear, endMonth, Number(range[4]));
    return first && last ? dateRange(first, last) : [];
  }

  const list = value.match(/(?:les?\s+)?((?:\d{1,2}\s*(?:,\s*|et\s+))+\d{1,2})\s+([\p{L}]+)(?:\s+(\d{4}))?/iu);
  if (list) {
    const month = normalizedMonth(list[2]);
    const year = Number(list[3] || fallbackYear);
    for (const token of list[1].match(/\d{1,2}/g) ?? []) {
      const date = isoDate(year, month, Number(token));
      if (date) dates.push(date);
    }
    return dates;
  }

  const single = value.match(/(?:le\s+)?(\d{1,2})\s+([\p{L}]+)(?:\s+(\d{4}))?/iu);
  if (!single) return [];
  const date = isoDate(Number(single[3] || fallbackYear), normalizedMonth(single[2]), Number(single[1]));
  return date ? [date] : [];
}

/** Ne retient que les annonces visant le Grand Palais pendant une journée
 * complète. Une fermeture anticipée ou limitée à une boutique est ignorée. */
export function extractGrandPalaisExceptionalClosures(
  html: string,
  pageUrl: string,
  fallbackYear = new Date().getUTCFullYear(),
) {
  const text = cleanText(html);
  const notices = [
    ...text.matchAll(/fermeture exceptionnelle\s*:\s*([^.;]{1,140})/gi),
    ...text.matchAll(/grand palais (?:sera |est )?fermé exceptionnellement(?: toute la journée)?\s*(?:le|les|du)?\s*([^.;]{1,140})/gi),
  ];
  const dates = [...new Set(notices.flatMap((match) => closureDates(match[1], fallbackYear)))];
  return dates.map((date) => ({
    id: stableId(`exceptional-closure:${date}`),
    title: "Fermeture exceptionnelle du Grand Palais",
    startDate: date,
    endDate: date,
    url: pageUrl,
    venueKey: "exceptional-closure",
    venueLabel: "Grand Palais",
  } satisfies SharedGrandPalaisEvent));
}

export function extractGrandPalaisProgramLinks(html: string) {
  const links = [...html.matchAll(/href=["']([^"']*\/fr\/programme\/[^"'#?]+)["']/gi)]
    .map((match) => officialGrandPalaisUrl(match[1]))
    .filter(Boolean);
  return [...new Set(links)];
}

function venueFromPage(html: string) {
  const candidates = [...html.matchAll(/<span[^>]*class=["'][^"']*icon-map-pin[^"']*["'][^>]*><\/span>([\s\S]{0,120}?)<\/p>/gi)]
    .map((match) => cleanText(match[1]));
  const text = candidates.join(" · ");
  const choices: Array<[RegExp, string, string]> = [
    [/galeries?\s*3\s*(?:et|&)\s*4/i, "galleries34", "Galeries 3 et 4"],
    [/galerie\s*8/i, "gallery8", "Galerie 8"],
    [/galerie\s*7/i, "gallery7", "Galerie 7"],
    [/galeries?\s*9\s*(?:et|&)\s*10/i, "gallery910", "Galeries 9 et 10"],
    [/palais des enfants/i, "childrenPalace", "Palais des enfants"],
    [/salon d[’']honneur/i, "other:salon-honneur", "Salon d’honneur"],
    [/\bnef\b/i, "nef", "Nef"],
  ];
  for (const [pattern, key, label] of choices)
    if (pattern.test(text)) return { venueKey: key, venueLabel: label };
  const genericGallery = text.match(/\b(?:galerie|salon)\s+[^·,;]{1,45}/i)?.[0];
  if (genericGallery) {
    const label = genericGallery.trim();
    const slug = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { venueKey: `other:${slug}`, venueLabel: label };
  }
  return null;
}

export function extractGrandPalaisEvent(html: string, pageUrl: string): SharedGrandPalaisEvent | null {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let event: Record<string, unknown> | undefined;
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(script[1]).trim()) as Record<string, unknown>;
      if (parsed["@type"] === "Event") {
        event = parsed;
        break;
      }
    } catch {
      // Une autre balise JSON-LD malformée ne doit pas annuler toute la relève.
    }
  }
  const venue = venueFromPage(html);
  const title = typeof event?.name === "string" ? event.name.trim() : "";
  const startDate = typeof event?.startDate === "string" ? event.startDate.slice(0, 10) : "";
  const endDate = typeof event?.endDate === "string" ? event.endDate.slice(0, 10) : "";
  if (!event || !venue || !title || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
    return null;
  const url = officialGrandPalaisUrl(
    typeof event.url === "string" ? event.url : pageUrl,
    officialGrandPalaisUrl(pageUrl),
  );
  if (!url) return null;
  return {
    id: stableId(url),
    title,
    startDate,
    endDate,
    url,
    venueKey: venue.venueKey,
    venueLabel: venue.venueLabel,
  };
}

export async function collectGrandPalaisEvents(fetcher: typeof fetch = fetch) {
  const listing = await fetchGrandPalaisHtml(`${OFFICIAL_ORIGIN}/fr/programme`, fetcher, true);
  const links = extractGrandPalaisProgramLinks(listing!);
  const events: SharedGrandPalaisEvent[] = [];
  for (let index = 0; index < links.length; index += 4) {
    const batch = links.slice(index, index + 4);
    const pages = await Promise.all(batch.map(async (url) => {
      const html = await fetchGrandPalaisHtml(url, fetcher);
      return html ? extractGrandPalaisEvent(html, url) : null;
    }));
    events.push(...pages.filter((event): event is SharedGrandPalaisEvent => Boolean(event)));
  }
  const practicalUrl = `${OFFICIAL_ORIGIN}/fr/informations-pratiques`;
  const practical = await fetchGrandPalaisHtml(practicalUrl, fetcher);
  if (practical)
    events.push(...extractGrandPalaisExceptionalClosures(practical, practicalUrl));
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

function eventChanged(previous: SharedGrandPalaisEvent, next: SharedGrandPalaisEvent) {
  return ["title", "startDate", "endDate", "venueKey", "venueLabel"]
    .some((key) => previous[key as keyof SharedGrandPalaisEvent] !== next[key as keyof SharedGrandPalaisEvent]);
}

function proposalId(kind: GrandPalaisProgramProposal["kind"], event: SharedGrandPalaisEvent) {
  return stableId(`${kind}:${event.id}:${JSON.stringify(event)}`, 24);
}

export function detectGrandPalaisChanges(
  state: GrandPalaisMonitorState | null,
  current: SharedGrandPalaisEvent[],
  now = new Date().toISOString(),
) {
  if (!state) {
    return {
      state: {
        lastCheckedAt: now,
        lastKnown: Object.fromEntries(current.map((event) => [event.id, event])),
        missingCounts: {},
      } satisfies GrandPalaisMonitorState,
      proposals: [] as GrandPalaisProgramProposal[],
    };
  }

  const today = now.slice(0, 10);
  const lastKnown = { ...state.lastKnown };
  const missingCounts = { ...state.missingCounts };
  const currentById = new Map(current.map((event) => [event.id, event]));
  const proposals: GrandPalaisProgramProposal[] = [];

  for (const event of current) {
    const previous = lastKnown[event.id];
    if (!previous) proposals.push({ id: proposalId("new", event), kind: "new", detectedAt: now, next: event });
    else if (eventChanged(previous, event))
      proposals.push({ id: proposalId("changed", event), kind: "changed", detectedAt: now, previous, next: event });
    lastKnown[event.id] = event;
    delete missingCounts[event.id];
  }

  for (const previous of Object.values(lastKnown)) {
    if (currentById.has(previous.id) || previous.endDate < today) continue;
    const misses = (missingCounts[previous.id] ?? 0) + 1;
    missingCounts[previous.id] = misses;
    if (misses === 2)
      proposals.push({ id: proposalId("removed", previous), kind: "removed", detectedAt: now, previous });
  }

  return {
    state: { lastCheckedAt: now, lastKnown, missingCounts } satisfies GrandPalaisMonitorState,
    proposals,
  };
}

export async function sendGrandPalaisAlertEmail(
  proposals: GrandPalaisProgramProposal[],
  env: Record<string, string | undefined> = runtimeEnv(),
  fetcher: typeof fetch = fetch,
) {
  const apiKey = env.RESEND_API_KEY;
  const recipient = env.PROGRAM_ADMIN_EMAIL;
  const from = env.PROGRAM_ALERT_FROM;
  if (!proposals.length) return false;
  if (!apiKey || !recipient || !from)
    throw new Error("Les variables d’alerte e-mail de la programmation GP sont incomplètes");
  const labels = { new: "Nouvelle programmation", changed: "Modification détectée", removed: "Retrait détecté" };
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
  const items = proposals.map((proposal) => {
    const event = proposal.next ?? proposal.previous!;
    const label = event.venueKey === "exceptional-closure" ? "Fermeture complète détectée" : labels[proposal.kind];
    return `<li><strong>${label} :</strong> ${escape(event.title)} — ${escape(event.venueLabel)} (${escape(event.startDate)} au ${escape(event.endDate)})</li>`;
  }).join("");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAND_PALAIS_FETCH_TIMEOUT_MS);
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `${proposals.length} changement${proposals.length > 1 ? "s" : ""} dans la programmation du Grand Palais`,
      html: `<p>Planning Solo a détecté une évolution du site officiel :</p><ul>${items}</ul><p>Ouvrez la rubrique Programmation GP pour accepter ou ignorer.</p>`,
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Envoi de l’alerte impossible (${response.status})`);
  return true;
}
