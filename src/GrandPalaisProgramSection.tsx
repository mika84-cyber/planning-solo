import { useEffect, useMemo, useState, type CSSProperties } from "react";
import "./grandPalaisProgram.css";
import { getSharedGrandPalaisProgram, reviewGrandPalaisProposal } from "./grandPalaisProgramApi";
import { matchesSearch } from "./searchMatching";
import { GRAND_PALAIS_PROGRAM } from "./grandPalaisProgramData";
import type {
  GrandPalaisProgramData,
  GrandPalaisProgramEntry,
  GrandPalaisProgramYear,
  GrandPalaisVenueKey,
} from "./grandPalaisProgramData";
import type {
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
  childrenPalace: { background: "#f8edc9", accent: "#9a711e", line: "#d5bd71" },
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
  { background: "#f3e5c8", accent: "#987023", line: "#d2b675" },
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
    return [{ startsOn, endsOn }];
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
  const [programView, setProgramView] = useState<ProgramView>("now");
  const [searchQuery, setSearchQuery] = useState("");
  const program = useMemo(
    () => mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, sharedPayload?.approved ?? []),
    [sharedPayload?.approved],
  );
  const [primaryChoice, setPrimaryChoice] = useState<PrimaryChoice>("galleries34");
  const [otherVenue, setOtherVenue] = useState<string>("nef");
  const otherVenueKeys = useMemo(() => [
    ...OTHER_VENUES,
    ...Object.keys(program)
      .filter((key) => key.startsWith("other:") && !OTHER_VENUES.includes(key as never))
      .sort((first, second) => program[first].label.length - program[second].label.length),
  ], [program]);
  const selectedVenueKey = primaryChoice === "other" ? otherVenue : primaryChoice;
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
  const overviewEntries = allEntries.filter(({ entry }) => {
    if (!matchesSearch(entry.title, normalizedSearch)) return false;
    return programView === "now" ? isGrandPalaisEntryCurrent(entry, today, openingReady) : Boolean(entry.startsOn && entry.startsOn >= today && !isGrandPalaisEntryCurrent(entry, today, openingReady));
  }).sort((left, right) => (left.entry.startsOn ?? "9999").localeCompare(right.entry.startsOn ?? "9999"));

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

  const selectVenue = (venueKey: PrimaryChoice) => {
    setPrimaryChoice(venueKey);
    const resolvedVenue = venueKey === "other" ? otherVenue : venueKey;
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
          <p>Consultez le programme par période ou par espace.</p>
        </div>
      </div>

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
            <small>Voir la programmation</small>
          </button>
        ))}
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
        </div>

        {primaryChoice === "other" ? (
          <div className="grand-palais-other-picker" role="tablist" aria-label="Autres espaces du Grand Palais">
            {otherVenueKeys.map((venueKey) => (
              <button
                key={venueKey}
                type="button"
                role="tab"
                aria-selected={otherVenue === venueKey}
                className={otherVenue === venueKey ? "active" : ""}
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
                  <small>{detail.timing}</small>
                </article>
              );
            }) : <p className="empty-state">Aucune période commune calculable pour le moment.</p>}
          </div>
        </section>
      ) : programView === "now" || programView === "upcoming" ? (
        <section className="useful-expo-schedule grand-palais-program-panel" aria-live="polite">
          <div className="useful-expo-schedule-heading"><h3>{programView === "now" ? "Ouvert en ce moment" : "Prochaines ouvertures"}</h3><p>Tous les espaces sont réunis dans cette vue.</p></div>
          <div className="useful-expo-timeline">
            {overviewEntries.length ? overviewEntries.map(({ entry, venueKey, venueLabel }) => {
              const status = grandPalaisEntryStatus(entry, today, openingReady);
              return <article key={`${venueKey}-${entry.title}-${entry.period}`} data-venue={venueKey} data-status={status.label} style={grandPalaisVenueStyle(venueKey)}><span className="useful-expo-timeline-mark" aria-hidden="true" /><div><small>{venueLabel} · {entry.period}</small><strong>{entry.title}</strong>{entry.details ? <p>{entry.details}</p> : null}{safeGrandPalaisUrl(entry.officialUrl) ? <a href={safeGrandPalaisUrl(entry.officialUrl)} target="_blank" rel="noreferrer">Voir le site officiel</a> : null}</div><em>{status.label}</em></article>;
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
          {entries.map((entry) => {
            const status = grandPalaisEntryStatus(entry, today, openingReady);
            return (
              <article
                key={`${entry.title}-${entry.period}`}
                data-venue={selectedVenueKey}
                data-status={status.label}
                style={grandPalaisVenueStyle(selectedVenueKey)}
              >
                <span className="useful-expo-timeline-mark" aria-hidden="true" />
                <div>
                  <small>{entry.period}</small>
                  <strong>{entry.title}</strong>
                  {entry.details ? <p>{entry.details}</p> : null}
                  {safeGrandPalaisUrl(entry.officialUrl) ? (
                    <a href={safeGrandPalaisUrl(entry.officialUrl)} target="_blank" rel="noreferrer">
                      Voir sur le site du Grand Palais
                    </a>
                  ) : null}
                </div>
                <em>{status.label}</em>
              </article>
            );
          })}
        </div>

      </section>
      )}
    </section>
  );
}
