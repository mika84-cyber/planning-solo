import { useEffect, useMemo, useState, type CSSProperties } from "react";
import "./grandPalaisProgram.css";
import { clearBoundaryReport, getSharedGrandPalaisProgram, reviewGrandPalaisProposal } from "./grandPalaisProgramApi";
import { matchesSearch } from "./searchMatching";
import { GRAND_PALAIS_PROGRAM } from "./grandPalaisProgramData";
import type {
  GrandPalaisProgramData,
  GrandPalaisProgramEntry,
  GrandPalaisProgramYear,
  GrandPalaisVenueKey,
} from "./grandPalaisProgramData";
import type {
  BoundaryReport,
  GrandPalaisProgramPayload,
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "./grandPalaisProgramTypes";

export type {
  GrandPalaisProgramYear,
  GrandPalaisVenueKey,
  GrandPalaisProgramEntry,
  GrandPalaisVenue,
  GrandPalaisProgramData,
} from "./grandPalaisProgramData";
export { GRAND_PALAIS_PROGRAM } from "./grandPalaisProgramData";

type GrandPalaisVenuePalette = { background: string; accent: string; line: string };

const GRAND_PALAIS_VENUE_PALETTES: Record<string, GrandPalaisVenuePalette> = {
  galleries34: { background: "#dcecff", accent: "#326fa8", line: "#8eb3d6" },
  gallery8: { background: "#e9ddf7", accent: "#73539d", line: "#b49bce" },
  gallery7: { background: "#f8dfe4", accent: "#a85261", line: "#d4a3ac" },
  childrenPalace: { background: "#f8edc9", accent: "#8f6a1b", line: "#d5bd71" },
  nef: { background: "#d9eee3", accent: "#35745a", line: "#8fbda9" },
  gallery910: { background: "#f5dfd0", accent: "#a45c32", line: "#d5a486" },
  "other:salon-seine": { background: "#d8eef2", accent: "#28798a", line: "#86bac4" },
  "other:salon-honneur": { background: "#f3dce9", accent: "#9a4d79", line: "#cea2ba" },
  "other:grand-palais": { background: "#e1e8ee", accent: "#526f88", line: "#aabac7" },
  "other:rotonde-salon-seine-palais-enfants": { background: "#dcebd5", accent: "#4d7a3d", line: "#a3c394" },
  "other:galeries-2-2": { background: "#f4dfc8", accent: "#9b6428", line: "#d2ae80" },
  "other:rotonde-d-antin": { background: "#e3e0f4", accent: "#655695", line: "#aaa1cc" },
};

const DYNAMIC_VENUE_PALETTES: GrandPalaisVenuePalette[] = [
  { background: "#d9edf5", accent: "#397d98", line: "#91bdcf" },
  { background: "#f4ddd5", accent: "#a4563f", line: "#d3a18f" },
  { background: "#e4e0f3", accent: "#675995", line: "#aba2cb" },
  { background: "#e3edd2", accent: "#607d35", line: "#acc28a" },
  { background: "#f3e5c8", accent: "#8c6720", line: "#d2b675" },
  { background: "#eeddea", accent: "#8e527b", line: "#c5a2bb" },
];

export function grandPalaisVenuePalette(venueKey: string): GrandPalaisVenuePalette {
  const known = GRAND_PALAIS_VENUE_PALETTES[venueKey];
  if (known) return known;
  const hash = [...venueKey].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return DYNAMIC_VENUE_PALETTES[hash % DYNAMIC_VENUE_PALETTES.length];
}

function grandPalaisVenueStyle(venueKey: string): CSSProperties {
  const palette = grandPalaisVenuePalette(venueKey);
  return { "--venue-bg": palette.background, "--venue-accent": palette.accent, "--venue-line": palette.line } as CSSProperties;
}

export function safeGrandPalaisUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === "https://www.grandpalais.fr"
      ? url.href
      : "";
  } catch {
    return "";
  }
}


function remotePeriod(event: SharedGrandPalaisEvent) {
  if (event.startDate === event.endDate) return `Date officielle : ${formatFrenchDate(event.startDate)}`;
  return `Du ${formatFrenchDate(event.startDate)} au ${formatFrenchDate(event.endDate)}`;
}

export function mergeSharedGrandPalaisProgram(
  base: GrandPalaisProgramData,
  sharedEvents: SharedGrandPalaisEvent[],
): GrandPalaisProgramData {
  const merged = Object.fromEntries(Object.entries(base).map(([key, venue]) => [
    key,
    {
      ...venue,
      schedule: Object.fromEntries(Object.entries(venue.schedule).map(([year, entries]) => [
        year,
        [...(entries ?? [])],
      ])),
    },
  ])) as GrandPalaisProgramData;

  for (const shared of sharedEvents) {
    if (shared.venueKey === "exceptional-closure") continue;
    const officialUrl = safeGrandPalaisUrl(shared.url);
    if (!officialUrl) continue;
    for (const venue of Object.values(merged))
      for (const year of Object.keys(venue.schedule))
        venue.schedule[Number(year)] = (venue.schedule[Number(year)] ?? []).filter((entry) =>
          entry.officialUrl !== officialUrl && entry.title.toLowerCase() !== shared.title.toLowerCase(),
        );
    if (shared.deleted) continue;

    const key = shared.venueKey;
    if (!merged[key]) merged[key] = {
      label: shared.venueLabel,
      heading: shared.venueLabel,
      schedule: {},
    };
    const entry: GrandPalaisProgramEntry = {
      title: shared.title,
      period: remotePeriod(shared),
      officialUrl,
      startsOn: shared.startDate,
      endsOn: shared.endDate,
    };
    const firstYear = Number(shared.startDate.slice(0, 4));
    const lastYear = Number(shared.endDate.slice(0, 4));
    for (let year = firstYear; year <= lastYear; year++) {
      const schedule = merged[key].schedule[year] ?? [];
      merged[key].schedule[year] = [...schedule, entry]
        .sort((left, right) => (left.startsOn ?? "9999").localeCompare(right.startsOn ?? "9999"));
    }
  }
  return merged;
}

const PRIMARY_VENUES = ["galleries34", "gallery8", "gallery7", "childrenPalace"] as const;
const OTHER_VENUES = ["nef", "gallery910"] as const;
const INTEREXPO_VENUES = ["galleries34", "gallery8", "gallery7"] as const;

type PrimaryChoice = GrandPalaisVenueKey | "other";
type ProgramView = "now" | "upcoming" | "space" | "interexpo";

export type InterExhibitionPeriod = {
  startsOn: string;
  endsOn: string;
  /** Les expositions qui ferment juste avant la période, la veille de son
   *  premier jour. */
  lastExhibitions?: string[];
};

export function describeInterExhibitionPeriod(period: InterExhibitionPeriod, today: string) {
  const durationDays = dayDistance(period.startsOn, period.endsOn) + 1;
  if (period.startsOn <= today && today <= period.endsOn) {
    const remainingDays = dayDistance(today, period.endsOn);
    return {
      durationDays,
      status: "En cours" as const,
      timing: remainingDays === 0
        ? "Se termine aujourd’hui"
        : `Se termine dans ${remainingDays} jour${remainingDays > 1 ? "s" : ""}`,
    };
  }
  const beforeStart = dayDistance(today, period.startsOn);
  return {
    durationDays,
    status: "À venir" as const,
    timing: beforeStart === 1 ? "Commence demain" : `Commence dans ${beforeStart} jours`,
  };
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatFrenchDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

function formatDatePart(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

/** Intitulé d'un regroupement mensuel : « Septembre 2026 ». */
function monthHeading(value: string) {
  const label = formatDatePart(value, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isGrandPalaisEntryVisible(
  entry: GrandPalaisProgramEntry,
  today = new Date().toISOString().slice(0, 10),
) {
  return !entry.endsOn || entry.endsOn >= today;
}

export function calculateInterExhibitionPeriods(
  today = new Date().toISOString().slice(0, 10),
  program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM,
): InterExhibitionPeriod[] {
  const datedEntries = INTEREXPO_VENUES.flatMap((venueKey) =>
    Object.values(program[venueKey].schedule)
      .flatMap((entries) => entries ?? [])
      .filter((entry): entry is GrandPalaisProgramEntry & { startsOn: string; endsOn: string } => Boolean(entry.startsOn && entry.endsOn))
  )
    .filter((entry, index, entries) => entries.findIndex((candidate) =>
      candidate.startsOn === entry.startsOn && candidate.endsOn === entry.endsOn && candidate.title === entry.title,
    ) === index)
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn));

  const openPeriods = datedEntries.reduce<Array<{ startsOn: string; endsOn: string }>>((periods, entry) => {
    const previous = periods.at(-1);
    if (!previous || entry.startsOn > addIsoDays(previous.endsOn, 1)) {
      periods.push({ startsOn: entry.startsOn, endsOn: entry.endsOn });
    } else if (entry.endsOn > previous.endsOn) {
      previous.endsOn = entry.endsOn;
    }
    return periods;
  }, []);

  return openPeriods.slice(1).flatMap((period, index) => {
    const startsOn = addIsoDays(openPeriods[index].endsOn, 1);
    const endsOn = addIsoDays(period.startsOn, -1);
    const durationInDays = Math.round(
      (new Date(`${endsOn}T12:00:00Z`).getTime() - new Date(`${startsOn}T12:00:00Z`).getTime()) / 86_400_000,
    ) + 1;
    if (durationInDays < 3 || endsOn < today) return [];
    const lastExhibitions = [...new Set(datedEntries
      .filter((entry) => entry.endsOn === openPeriods[index].endsOn)
      .map((entry) => entry.title))];
    return [{ startsOn, endsOn, lastExhibitions }];
  });
}

function venueYears(
  venueKey: string,
  today = new Date().toISOString().slice(0, 10),
  program: GrandPalaisProgramData = GRAND_PALAIS_PROGRAM,
) {
  return Object.keys(program[venueKey]?.schedule ?? {})
    .map(Number)
    .filter((year) => (program[venueKey].schedule[year] ?? [])
      .some((entry) => isGrandPalaisEntryVisible(entry, today)))
    .sort((left, right) => left - right) as GrandPalaisProgramYear[];
}

/** Les espaces de « Autres » qui ont encore une exposition au programme. Un
 *  espace vide en disparaît, et y revient seul dès qu'une exposition détectée
 *  sur le site du Grand Palais y est acceptée par l'administratrice. */
export function otherGrandPalaisVenueKeys(program: GrandPalaisProgramData, today: string) {
  return [
    ...OTHER_VENUES,
    ...Object.keys(program)
      .filter((key) => key.startsWith("other:") && !OTHER_VENUES.includes(key as never))
      .sort((first, second) => program[first].label.length - program[second].label.length),
  ].filter((key) => venueYears(key, today, program).length > 0);
}

export function grandPalaisClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return { today: `${part("year")}-${part("month")}-${part("day")}`, openingReady: Number(part("hour")) * 60 + Number(part("minute")) >= 5 };
}

export function isGrandPalaisEntryCurrent(
  entry: GrandPalaisProgramEntry,
  today = new Date().toISOString().slice(0, 10),
  openingReady = true,
) {
  if (entry.startsOn === today && !openingReady) return false;
  return entry.currentlyOpen === true
    || Boolean(entry.startsOn && entry.endsOn && entry.startsOn <= today && today <= entry.endsOn);
}

function dayDistance(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

export function grandPalaisEntryStatus(
  entry: GrandPalaisProgramEntry,
  today = new Date().toISOString().slice(0, 10),
  openingReady = true,
) {
  if (entry.uncertain || (!entry.startsOn && entry.currentlyOpen !== true))
    return { label: "À confirmer", detail: "" };
  if (isGrandPalaisEntryCurrent(entry, today, openingReady)) {
    const remaining = entry.endsOn ? Math.max(0, dayDistance(today, entry.endsOn)) : null;
    return {
      label: "En cours",
      detail: remaining === null ? "" : remaining === 0 ? "Dernier jour" : `${remaining} jour${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`,
    };
  }
  if (entry.startsOn === today && !openingReady) return { label: "Prochainement", detail: "Commence aujourd’hui à 00 h 05" };
  if (entry.startsOn && entry.startsOn > today) {
    const beforeOpening = dayDistance(today, entry.startsOn);
    return {
      label: "Prochainement",
      detail: beforeOpening === 1 ? "Commence demain" : `Commence dans ${beforeOpening} jours`,
    };
  }
  return { label: "À confirmer", detail: "" };
}

/** Une exposition : la salle, le titre, la période et le temps restant. Une
 *  exposition ouverte montre en plus où elle en est. */
function ExpoCard({ entry, venueKey, venueLabel, today, openingReady, linkLabel }: {
  entry: GrandPalaisProgramEntry;
  venueKey: string;
  venueLabel?: string;
  today: string;
  openingReady: boolean;
  linkLabel: string;
}) {
  const status = grandPalaisEntryStatus(entry, today, openingReady);
  const current = status.label === "En cours";
  const countdown = status.label === "Prochainement" ? status.detail.replace(/^Commence /, "") : "";
  const upcomingCountdown = countdown ? countdown.charAt(0).toUpperCase() + countdown.slice(1) : "";
  const totalDays = entry.startsOn && entry.endsOn ? dayDistance(entry.startsOn, entry.endsOn) : 0;
  const progress = current && totalDays > 0 && entry.startsOn
    ? Math.min(100, Math.max(0, Math.round((dayDistance(entry.startsOn, today) / totalDays) * 100)))
    : null;
  const officialUrl = safeGrandPalaisUrl(entry.officialUrl);
  return (
    <article
      className="expo-card"
      data-venue={venueKey}
      data-status={status.label}
      style={grandPalaisVenueStyle(venueKey)}
    >
      <span className="useful-expo-timeline-mark" aria-hidden="true" />
      <div>
        {venueLabel ? <span className="useful-expo-venue">{venueLabel}</span> : null}
        <strong>{entry.title}</strong>
        {entry.details ? <p>{entry.details}</p> : null}
        <small>{entry.period}</small>
        {progress !== null ? (
          <span className="expo-progress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </span>
        ) : null}
        {officialUrl ? <a href={officialUrl} target="_blank" rel="noreferrer">{linkLabel}</a> : null}
      </div>
      {/* Une exposition à venir n'a besoin que de son compte à rebours :
          « Prochainement » redirait ce que la date annonce déjà. */}
      <footer className="expo-card-status">
        {upcomingCountdown ? <em>{upcomingCountdown}</em> : <em>{status.label}</em>}
        {status.detail && !upcomingCountdown ? <span>{status.detail}</span> : null}
      </footer>
    </article>
  );
}

/** Ce que le contrôle hebdomadaire des frontières a constaté. Affiché à la
 *  seule administratrice : un contrôle ne peut pas rendre compte par le
 *  canal qu'il teste, il lui faut donc un endroit dans l'application. */
export function BoundaryReportPanel({
  report,
  onClear,
  clearing = false,
  error = "",
}: {
  report: BoundaryReport;
  onClear?: () => void;
  clearing?: boolean;
  error?: string;
}) {
  const failingBoundaries = report.boundaries.filter((boundary) => !boundary.ok);
  return (
    <section className="grand-palais-admin-alerts" aria-labelledby="grand-palais-health-title">
      <div>
        <span className="step-label">Réservé à votre compte</span>
        <h3 id="grand-palais-health-title">Contrôle des alertes</h3>
        <p>
          {failingBoundaries.length
            ? "Une alerte pourrait ne pas vous parvenir."
            : "Tout ce qui doit vous prévenir répond."}{" "}
          Vérifié le {formatFrenchDate(report.checkedAt.slice(0, 10))}.
        </p>
        {onClear ? (
          <button type="button" className="grand-palais-health-clear" disabled={clearing} onClick={onClear}>
            {clearing ? "Effacement…" : "Effacer ces données"}
          </button>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <div className="grand-palais-admin-alert-list">
        {report.boundaries.map((boundary) => (
          <article key={boundary.name}>
            <small>{boundary.ok ? "Répond" : "Ne répond pas"}</small>
            <strong>{boundary.name}</strong>
            <span>{boundary.detail}</span>
          </article>
        ))}
        {report.deliveryDetail ? (
          <article>
            <small>Envoi réel, une fois par mois</small>
            <strong>Preuve de livraison</strong>
            <span>
              {report.deliveryDetail}
              {report.lastDeliveryAt
                ? ` — le ${formatFrenchDate(report.lastDeliveryAt.slice(0, 10))}`
                : ""}
            </span>
          </article>
        ) : null}
      </div>
    </section>
  );
}

export function GrandPalaisProgramSection({ guestPreview = false }: { guestPreview?: boolean }) {
  const [clock, setClock] = useState(() => grandPalaisClock());
  const { today, openingReady } = clock;
  useEffect(() => {
    const refresh = () => setClock(previous => {
      const next = grandPalaisClock();
      return previous.today === next.today && previous.openingReady === next.openingReady ? previous : next;
    });
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { refresh(); timer = setTimeout(tick, 60_000 - Date.now() % 60_000); };
    tick();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const [sharedPayload, setSharedPayload] = useState<GrandPalaisProgramPayload | null>(null);
  const [reviewBusy, setReviewBusy] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [programView, setProgramView] = useState<ProgramView>("now");
  const [searchQuery, setSearchQuery] = useState("");
  const program = useMemo(
    () => mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, sharedPayload?.approved ?? []),
    [sharedPayload?.approved],
  );
  const [primaryChoice, setPrimaryChoice] = useState<PrimaryChoice>("galleries34");
  const [otherVenue, setOtherVenue] = useState<string>("nef");
  const otherVenueKeys = useMemo(() => otherGrandPalaisVenueKeys(program, today), [program, today]);
  const activeOtherVenue = otherVenueKeys.includes(otherVenue) ? otherVenue : otherVenueKeys[0] ?? "nef";
  const selectedVenueKey = primaryChoice === "other" ? activeOtherVenue : primaryChoice;
  const [selectedYear, setSelectedYear] = useState<GrandPalaisProgramYear>(2026);
  const venue = program[selectedVenueKey] ?? program.nef;
  const years = useMemo(() => venueYears(selectedVenueKey, today, program), [selectedVenueKey, today, program]);
  const normalizedSearch = searchQuery.trim();
  const entries = (venue.schedule[selectedYear] ?? []).filter((entry) => isGrandPalaisEntryVisible(entry, today)
    && matchesSearch(entry.title, normalizedSearch));
  const interExhibitionPeriods = useMemo(() => calculateInterExhibitionPeriods(today, program), [today, program]);
  const allEntries = useMemo(() => {
    const seen = new Set<string>();
    return Object.entries(program).flatMap(([venueKey, item]) => Object.values(item.schedule).flatMap((scheduled) => scheduled ?? []).map((entry) => ({
      entry,
      venueKey,
      venueLabel: item.label,
    }))).filter(({ entry, venueKey }) => {
      const key = `${venueKey}:${entry.title}:${entry.endsOn || entry.period}`;
      if (seen.has(key) || !isGrandPalaisEntryVisible(entry, today)) return false;
      seen.add(key);
      return true;
    });
  }, [program, today]);
  const currentEntries = allEntries
    .filter(({ entry }) => isGrandPalaisEntryCurrent(entry, today, openingReady))
    // Celles qui ferment le plus tôt d'abord : ce sont les dernières à voir.
    .sort((left, right) => (left.entry.endsOn ?? "9999").localeCompare(right.entry.endsOn ?? "9999"));
  const upcomingEntries = allEntries
    .filter(({ entry }) => Boolean(entry.startsOn && entry.startsOn >= today && !isGrandPalaisEntryCurrent(entry, today, openingReady)))
    .sort((left, right) => (left.entry.startsOn ?? "9999").localeCompare(right.entry.startsOn ?? "9999"));
  const overviewEntries = (programView === "now" ? currentEntries : upcomingEntries)
    .filter(({ entry }) => matchesSearch(entry.title, normalizedSearch));
  const nextOpening = upcomingEntries[0];
  const venueEntryCount = (venueKey: string) => new Set(Object.values(program[venueKey]?.schedule ?? {})
    .flatMap((scheduled) => scheduled ?? [])
    .filter((entry) => isGrandPalaisEntryVisible(entry, today))
    .map((entry) => entry.title)).size;

  useEffect(() => {
    let active = true;
    void getSharedGrandPalaisProgram()
      .then((payload) => active && setSharedPayload(payload))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const reviewProposal = async (
    proposal: GrandPalaisProgramProposal,
    decision: "accept" | "ignore",
  ) => {
    setReviewBusy(proposal.id);
    setReviewError("");
    try {
      setSharedPayload(await reviewGrandPalaisProposal(proposal.id, decision));
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "La décision n’a pas pu être enregistrée.");
    } finally {
      setReviewBusy("");
    }
  };

  const clearHealth = async () => {
    if (!window.confirm("Effacer le contrôle des alertes ? Il sera refait lundi à minuit.")) return;
    setHealthBusy(true);
    setHealthError("");
    try {
      setSharedPayload(await clearBoundaryReport());
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Le contrôle n’a pas pu être effacé.");
    } finally {
      setHealthBusy(false);
    }
  };

  const selectVenue = (venueKey: PrimaryChoice) => {
    setPrimaryChoice(venueKey);
    const resolvedVenue = venueKey === "other" ? activeOtherVenue : venueKey;
    setSelectedYear(venueYears(resolvedVenue, today, program)[0] ?? 2026);
  };

  const selectOtherVenue = (venueKey: string) => {
    setOtherVenue(venueKey);
    setSelectedYear(venueYears(venueKey, today, program)[0] ?? 2026);
  };

  return (
    <section className="grand-palais-program-screen" aria-labelledby="grand-palais-program-title">
      <div className="grand-palais-program-intro">
        <div className="native-screen-heading">
          <span className="step-label">Grand Palais</span>
          <h2 id="grand-palais-program-title">Expositions et événements</h2>
          <p className="grand-palais-program-summary">
            {currentEntries.length
              ? `${currentEntries.length} exposition${currentEntries.length > 1 ? "s" : ""} ouverte${currentEntries.length > 1 ? "s" : ""} aujourd’hui.`
              : "Aucune exposition ouverte aujourd’hui."}
            {nextOpening ? (
              <> Prochaine ouverture : <b>{nextOpening.entry.title}</b>, {grandPalaisEntryStatus(nextOpening.entry, today, openingReady).detail.replace(/^Commence /, "") || "bientôt"}.</>
            ) : null}
          </p>
        </div>
      </div>

      {!guestPreview && sharedPayload?.isAdmin && sharedPayload.health ? (
        <BoundaryReportPanel
          report={sharedPayload.health}
          onClear={() => void clearHealth()}
          clearing={healthBusy}
          error={healthError}
        />
      ) : null}

      {!guestPreview && sharedPayload?.isAdmin && sharedPayload.pending.length ? (
        <section className="grand-palais-admin-alerts" aria-labelledby="grand-palais-alerts-title">
          <div>
            <span className="step-label">Réservé à votre compte</span>
            <h3 id="grand-palais-alerts-title">Mises à jour détectées</h3>
            <p>Acceptez pour les rendre visibles à tout le monde, ou ignorez-les.</p>
          </div>
          <div className="grand-palais-admin-alert-list">
            {sharedPayload.pending.map((proposal) => {
              const event = proposal.next ?? proposal.previous!;
              const kindLabel = event.venueKey === "exceptional-closure" ? "Fermeture exceptionnelle"
                : proposal.kind === "new" ? "Nouvelle exposition"
                : proposal.kind === "changed" ? "Informations modifiées" : "Exposition retirée du site";
              return (
                <article key={proposal.id}>
                  <small>{kindLabel} · {event.venueLabel}</small>
                  <strong>{event.title}</strong>
                  <span>{event.startDate === event.endDate
                    ? `Date officielle : ${formatFrenchDate(event.startDate)}`
                    : `Du ${formatFrenchDate(event.startDate)} au ${formatFrenchDate(event.endDate)}`}</span>
                  <div>
                    <button type="button" disabled={reviewBusy === proposal.id} onClick={() => void reviewProposal(proposal, "accept")}>Accepter</button>
                    <button type="button" disabled={reviewBusy === proposal.id} onClick={() => void reviewProposal(proposal, "ignore")}>Ignorer</button>
                  </div>
                </article>
              );
            })}
          </div>
          {reviewError ? <p className="grand-palais-review-error" role="alert">{reviewError}</p> : null}
        </section>
      ) : null}

      <div className="grand-palais-view-tools">
        <div className="grand-palais-view-picker" role="tablist" aria-label="Vue de la programmation">
          {([["now", "En ce moment"], ["upcoming", "À venir"], ["space", "Par espace"], ["interexpo", "Inter-expos"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={programView === value} className={programView === value ? "active" : ""} onClick={() => setProgramView(value)}>{label}</button>
          ))}
        </div>
        {programView !== "interexpo" ? <label className="grand-palais-search"><span>Rechercher une exposition</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Titre de l’exposition" /></label> : null}
      </div>

      {programView === "space" ? <section className="grand-palais-venue-navigation" aria-labelledby="grand-palais-spaces-title">
        <div className="grand-palais-venue-navigation-heading">
          <span className="step-label">Les galeries</span>
          <h3 id="grand-palais-spaces-title">Choisir un espace</h3>
          <p>Sélectionnez une galerie pour consulter sa programmation.</p>
        </div>
        <div className="grand-palais-primary-picker" role="tablist" aria-label="Espace principal du Grand Palais">
        {PRIMARY_VENUES.map((venueKey) => (
          <button
            key={venueKey}
            type="button"
            role="tab"
            aria-selected={primaryChoice === venueKey}
            className={primaryChoice === venueKey ? "active" : ""}
            style={grandPalaisVenueStyle(venueKey)}
            onClick={() => selectVenue(venueKey)}
          >
            <span>{program[venueKey].label}</span>
            <small>{venueEntryCount(venueKey)
              ? `${venueEntryCount(venueKey)} exposition${venueEntryCount(venueKey) > 1 ? "s" : ""} au programme`
              : "Rien d’annoncé pour l’instant"}</small>
          </button>
        ))}
        {otherVenueKeys.length ? (
          <button
            type="button"
            role="tab"
            aria-selected={primaryChoice === "other"}
            className={primaryChoice === "other" ? "active" : ""}
            onClick={() => selectVenue("other")}
          >
            <span>Autres</span>
            <small>Nef et autres galeries RMN</small>
          </button>
        ) : null}
        </div>

        {primaryChoice === "other" ? (
          <div className="grand-palais-other-picker" role="tablist" aria-label="Autres espaces du Grand Palais">
            {otherVenueKeys.map((venueKey) => (
              <button
                key={venueKey}
                type="button"
                role="tab"
                aria-selected={activeOtherVenue === venueKey}
                className={activeOtherVenue === venueKey ? "active" : ""}
                style={grandPalaisVenueStyle(venueKey)}
                onClick={() => selectOtherVenue(venueKey)}
              >
                {program[venueKey].label}
              </button>
            ))}
          </div>
        ) : null}
      </section> : null}

      {programView === "interexpo" ? (
        <section className="useful-expo-schedule grand-palais-program-panel grand-palais-interexpo-panel" aria-labelledby="grand-palais-interexpo-title">
          <div className="useful-expo-schedule-heading">
            <span className="step-label">Galeries 3–4 · 8 · 7</span>
            <h3 id="grand-palais-interexpo-title">Périodes d’inter expos</h3>
            <p>
              À la date d’aujourd’hui, le {formatFrenchDate(today)}, voici les périodes où aucune exposition
              n’est ouverte dans les galeries 3–4, 8 et 7.
            </p>
          </div>
          <div className="grand-palais-interexpo-list">
            {interExhibitionPeriods.length ? interExhibitionPeriods.map((period, index) => {
              const detail = describeInterExhibitionPeriod(period, today);
              return (
                <article key={`${period.startsOn}-${period.endsOn}`} data-status={detail.status}>
                  <header><span>Période {index + 1}</span><em>{detail.status}</em></header>
                  <strong>Du {formatFrenchDate(period.startsOn)} au {formatFrenchDate(period.endsOn)}</strong>
                  <p><b>{detail.durationDays} jours</b> sans exposition ouverte dans les trois galeries.</p>
                  {period.lastExhibitions?.length ? (
                    <p className="grand-palais-interexpo-last">
                      Dernière expo avant : <b>{period.lastExhibitions.join(" et ")}</b>, jusqu’au {formatFrenchDate(addIsoDays(period.startsOn, -1)).replace(/^1 /, "1er ")}
                    </p>
                  ) : null}
                  <small>{detail.timing}</small>
                </article>
              );
            }) : <p className="empty-state">Aucune période commune calculable pour le moment.</p>}
          </div>
        </section>
      ) : programView === "now" || programView === "upcoming" ? (
        <section className="useful-expo-schedule grand-palais-program-panel" aria-live="polite">
          <div className="useful-expo-schedule-heading">
            <h3>{programView === "now" ? "Ouvert en ce moment" : "Prochaines ouvertures"}</h3>
            <p>{programView === "now"
              ? "Tous les espaces réunis, celles qui ferment le plus tôt en premier."
              : "Tous les espaces réunis, mois par mois."}</p>
          </div>
          <div className="useful-expo-timeline">
            {overviewEntries.length ? overviewEntries.map(({ entry, venueKey, venueLabel }, index) => {
              // « À venir » se lit mois par mois : un intitulé ouvre chaque mois.
              const month = programView === "upcoming" && entry.startsOn ? entry.startsOn.slice(0, 7) : "";
              const previousMonth = index > 0 ? overviewEntries[index - 1].entry.startsOn?.slice(0, 7) : "";
              return (
                <div className="expo-card-slot" key={`${venueKey}-${entry.title}-${entry.period}`}>
                  {month && month !== previousMonth ? <h4 className="expo-month-heading">{monthHeading(entry.startsOn!)}</h4> : null}
                  <ExpoCard entry={entry} venueKey={venueKey} venueLabel={venueLabel} today={today} openingReady={openingReady} linkLabel="Voir le site officiel" />
                </div>
              );
            }) : <p className="empty-state">Aucune exposition ne correspond à cette vue.</p>}
          </div>
        </section>
      ) : (
      <section className="useful-expo-schedule grand-palais-program-panel" aria-label={`Programmation ${venue.label}`}>
        <div className="useful-expo-schedule-heading">
          <span className="step-label">{venue.heading}</span>
        </div>

        <div className="useful-expo-year-picker" role="tablist" aria-label="Année de programmation">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={selectedYear === year}
              className={selectedYear === year ? "active" : ""}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>

        <div className="useful-expo-timeline" role="tabpanel" aria-label={`${venue.label} - ${selectedYear}`}>
          {entries.map((entry) => (
            <ExpoCard
              key={`${entry.title}-${entry.period}`}
              entry={entry}
              venueKey={selectedVenueKey}
              today={today}
              openingReady={openingReady}
              linkLabel="Voir sur le site du Grand Palais"
            />
          ))}
        </div>

      </section>
      )}
    </section>
  );
}
