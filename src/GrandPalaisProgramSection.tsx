import { useEffect, useMemo, useState } from "react";
import "./grandPalaisProgram.css";
import { getSharedGrandPalaisProgram, reviewGrandPalaisProposal } from "./grandPalaisProgramApi";
import type {
  GrandPalaisProgramPayload,
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "./grandPalaisProgramTypes";

export type GrandPalaisProgramYear = number;
export type GrandPalaisVenueKey =
  | "galleries34"
  | "gallery8"
  | "gallery7"
  | "nef"
  | "gallery910"
  | "childrenPalace";

export type GrandPalaisProgramEntry = {
  title: string;
  period: string;
  details?: string;
  uncertain?: boolean;
  officialUrl?: string;
  startsOn?: string;
  endsOn?: string;
  currentlyOpen?: boolean;
};

type GrandPalaisVenue = {
  label: string;
  heading: string;
  schedule: Partial<Record<GrandPalaisProgramYear, GrandPalaisProgramEntry[]>>;
};

type GrandPalaisProgramData = Record<string, GrandPalaisVenue>;

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

export const GRAND_PALAIS_PROGRAM: Record<GrandPalaisVenueKey, GrandPalaisVenue> = {
  galleries34: {
    label: "Galeries 3 et 4",
    heading: "Galeries 3 et 4 · Champs-Élysées",
    schedule: {
      2026: [
        {
          title: "Cezanne et nous",
          period: "Du 23 septembre 2026 au 17 janvier 2027",
          details: "J-R Touzet · X. Rey · C. Bernardi · M. Gauthier",
          officialUrl: "https://www.grandpalais.fr/fr/programme/cezanne-et-nous",
          startsOn: "2026-09-23",
          endsOn: "2027-01-17",
        },
      ],
      2027: [
        {
          title: "Cezanne et nous",
          period: "Jusqu’au 17 janvier 2027",
          details: "J-R Touzet · X. Rey · C. Bernardi · M. Gauthier",
          startsOn: "2026-09-23",
          endsOn: "2027-01-17",
        },
        {
          title: "Marcel Duchamp, portrait possible",
          period: "Du 23 mars au 1er août 2027",
          details: "Titre non validé · J. Brun",
          uncertain: true,
          startsOn: "2027-03-23",
          endsOn: "2027-08-01",
        },
        {
          title: "Chagall",
          period: "Du 5 octobre 2027 au 16 janvier 2028",
          details: "A. Lampe",
          startsOn: "2027-10-05",
          endsOn: "2028-01-16",
        },
      ],
      2028: [
        {
          title: "Chagall",
          period: "Jusqu’au 16 janvier 2028",
          details: "A. Lampe",
          startsOn: "2027-10-05",
          endsOn: "2028-01-16",
        },
        {
          title: "Yves Klein",
          period: "Du 21 mars au 16 juillet 2028",
          details: "Dates et titre à confirmer · H. Guenin · M. Gherghescu",
          uncertain: true,
          startsOn: "2028-03-21",
          endsOn: "2028-07-16",
        },
        {
          title: "Projet #10",
          period: "Après le 20 septembre 2028, jusqu’au début janvier 2029",
          details: "Calendrier prévisionnel",
          uncertain: true,
        },
      ],
      2029: [
        {
          title: "Projet #10",
          period: "Jusqu’au début janvier 2029",
          details: "Calendrier prévisionnel",
          uncertain: true,
        },
        {
          title: "Jean Arp & Sophie Taeuber-Arp",
          period: "De mars à juillet 2029",
          details: "Titre et dates à confirmer",
          uncertain: true,
        },
        {
          title: "Projet #12",
          period: "À l’automne 2029",
          details: "Titre et dates à confirmer",
          uncertain: true,
        },
      ],
    },
  },
  gallery8: {
    label: "Galerie 8",
    heading: "Galerie 8 · Seine",
    schedule: {
      2026: [
        {
          title: "Hilma af Klint - Les peintures du Temple (1906-1915)",
          period: "Du 6 mai au 30 août 2026",
          officialUrl: "https://www.grandpalais.fr/fr/programme/hilma-af-klint",
          startsOn: "2026-05-06",
          endsOn: "2026-08-30",
        },
        {
          title: "Girls - Adolescence, mode et rébellion",
          period: "Du 9 décembre 2026 au 21 mars 2027",
          officialUrl: "https://www.grandpalais.fr/fr/programme/girls-adolescence-mode-et-rebellion",
          startsOn: "2026-12-09",
          endsOn: "2027-03-21",
        },
      ],
    },
  },
  gallery7: {
    label: "Galerie 7",
    heading: "Galerie 7",
    schedule: {
      2026: [
        {
          title: "Le Musée Imaginaire d’Oli",
          period: "Du 2 décembre 2026 au 21 février 2027",
          startsOn: "2026-12-02",
          endsOn: "2027-02-21",
        },
      ],
    },
  },
  nef: {
    label: "Nef",
    heading: "Nef du Grand Palais",
    schedule: {
      2026: [
        {
          title: "Grand Palais d’été - Édition 2026",
          period: "À partir du 2 juin 2026",
          details: "Programmation pluridisciplinaire dans la Nef",
          officialUrl: "https://www.grandpalais.fr/fr/programme/grand-palais-dete-2026",
          startsOn: "2026-06-02",
          currentlyOpen: true,
        },
        { title: "SIBCA - Salon de l’Immobilier Bas Carbone", period: "Du 1er au 3 septembre 2026", startsOn: "2026-09-01", endsOn: "2026-09-03" },
        { title: "Sommet international sur l’espace", period: "Les 9 et 10 septembre 2026", startsOn: "2026-09-09", endsOn: "2026-09-10" },
        { title: "Fine Arts Paris", period: "Du 19 au 23 septembre 2026", startsOn: "2026-09-19", endsOn: "2026-09-23" },
        { title: "Art Basel", period: "Du 23 au 25 octobre 2026", startsOn: "2026-10-23", endsOn: "2026-10-25" },
        { title: "Paris Photo World Supreme", period: "Du 12 au 15 novembre 2026", startsOn: "2026-11-12", endsOn: "2026-11-15" },
        { title: "Arabian Horse Championship", period: "Du 25 au 27 novembre 2026", startsOn: "2026-11-25", endsOn: "2026-11-27" },
        { title: "Adopt AI", period: "Les 3 et 4 décembre 2026", startsOn: "2026-12-03", endsOn: "2026-12-04" },
        { title: "Le Grand Palais des Glaces", period: "Du 13 décembre 2026 au 6 janvier 2027", startsOn: "2026-12-13", endsOn: "2027-01-06" },
      ],
      2027: [
        { title: "Le Grand Palais des Glaces", period: "Jusqu’au 6 janvier 2027", startsOn: "2026-12-13", endsOn: "2027-01-06" },
        { title: "Art Basel Paris", period: "Du 20 au 24 octobre 2027", uncertain: true, startsOn: "2027-10-20", endsOn: "2027-10-24" },
      ],
      2028: [
        { title: "Art Basel Paris", period: "Du 18 au 22 octobre 2028", uncertain: true, startsOn: "2028-10-18", endsOn: "2028-10-22" },
      ],
      2029: [
        { title: "Art Basel Paris", period: "Du 17 au 21 octobre 2029", uncertain: true, startsOn: "2029-10-17", endsOn: "2029-10-21" },
      ],
    },
  },
  gallery910: {
    label: "Galeries 9 et 10",
    heading: "Galeries 9 et 10",
    schedule: {
      2026: [
        {
          title: "Leandro Erlich",
          period: "Du 2 juin au 6 septembre 2026",
          officialUrl: "https://www.grandpalais.fr/fr/programme/leandro-erlich",
          startsOn: "2026-06-02",
          endsOn: "2026-09-06",
        },
        {
          title: "Mika Ninagawa with EiM - Alive with Shadows",
          period: "Du 16 décembre 2026 au 21 mars 2027",
          officialUrl: "https://www.grandpalais.fr/en/program/mika-ninagawa-eim-alive-shadows",
          startsOn: "2026-12-16",
          endsOn: "2027-03-21",
        },
      ],
      2029: [
        {
          title: "Peter Doig",
          period: "Jusqu’en mars 2030",
          details: "Dates à confirmer",
          uncertain: true,
        },
      ],
    },
  },
  childrenPalace: {
    label: "Palais des enfants",
    heading: "Palais des enfants",
    schedule: {
      2026: [
        {
          title: "Transparence",
          period: "Du 20 juin 2025 au 29 août 2027",
          details: "La première exposition du Palais des enfants · Pour les enfants de 2 à 10 ans",
          officialUrl: "https://www.grandpalais.fr/fr/programme/transparence",
          startsOn: "2025-06-20",
          endsOn: "2027-08-29",
        },
      ],
      2027: [
        {
          title: "Transparence",
          period: "Jusqu’au 29 août 2027",
          details: "La première exposition du Palais des enfants · Pour les enfants de 2 à 10 ans",
          officialUrl: "https://www.grandpalais.fr/fr/programme/transparence",
          startsOn: "2025-06-20",
          endsOn: "2027-08-29",
        },
      ],
    },
  },
};

function remotePeriod(event: SharedGrandPalaisEvent) {
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

type PrimaryChoice = GrandPalaisVenueKey | "other" | "interexpo";

export type InterExhibitionPeriod = {
  startsOn: string;
  endsOn: string;
};

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

export function isGrandPalaisEntryCurrent(
  entry: GrandPalaisProgramEntry,
  today = new Date().toISOString().slice(0, 10),
) {
  return entry.currentlyOpen === true
    || Boolean(entry.startsOn && entry.endsOn && entry.startsOn <= today && today <= entry.endsOn);
}

export function GrandPalaisProgramSection() {
  const today = new Date().toISOString().slice(0, 10);
  const [sharedPayload, setSharedPayload] = useState<GrandPalaisProgramPayload | null>(null);
  const [reviewBusy, setReviewBusy] = useState("");
  const [reviewError, setReviewError] = useState("");
  const program = useMemo(
    () => mergeSharedGrandPalaisProgram(GRAND_PALAIS_PROGRAM, sharedPayload?.approved ?? []),
    [sharedPayload?.approved],
  );
  const [primaryChoice, setPrimaryChoice] = useState<PrimaryChoice>("galleries34");
  const [otherVenue, setOtherVenue] = useState<string>("nef");
  const otherVenueKeys = useMemo(() => [
    ...OTHER_VENUES,
    ...Object.keys(program).filter((key) => key.startsWith("other:") && !OTHER_VENUES.includes(key as never)),
  ], [program]);
  const selectedVenueKey = primaryChoice === "other" || primaryChoice === "interexpo" ? otherVenue : primaryChoice;
  const [selectedYear, setSelectedYear] = useState<GrandPalaisProgramYear>(2026);
  const venue = program[selectedVenueKey] ?? program.nef;
  const years = useMemo(() => venueYears(selectedVenueKey, today, program), [selectedVenueKey, today, program]);
  const entries = (venue.schedule[selectedYear] ?? []).filter((entry) => isGrandPalaisEntryVisible(entry, today));
  const interExhibitionPeriods = useMemo(() => calculateInterExhibitionPeriods(today, program), [today, program]);

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
    if (venueKey === "interexpo") return;
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
          <h2 id="grand-palais-program-title">Programmation GP</h2>
          <p>Retrouvez les expositions et événements prévisionnels par espace et par année.</p>
        </div>
      </div>

      {sharedPayload?.isAdmin && sharedPayload.pending.length ? (
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
                  <span>Du {formatFrenchDate(event.startDate)} au {formatFrenchDate(event.endDate)}</span>
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

      <section className="grand-palais-venue-navigation" aria-labelledby="grand-palais-spaces-title">
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
          <small>Nef · Galeries 9 et 10</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={primaryChoice === "interexpo"}
          className={primaryChoice === "interexpo" ? "active" : ""}
          onClick={() => selectVenue("interexpo")}
        >
          <span>Périodes d’inter expos</span>
          <small>Galeries 3–4 · 8 · 7</small>
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
                onClick={() => selectOtherVenue(venueKey)}
              >
                {program[venueKey].label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {primaryChoice === "interexpo" ? (
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
            {interExhibitionPeriods.length ? interExhibitionPeriods.map((period) => (
              <article key={`${period.startsOn}-${period.endsOn}`}>
                <strong>Du {formatFrenchDate(period.startsOn)} au {formatFrenchDate(period.endsOn)}</strong>
              </article>
            )) : <p>Aucune période commune calculable pour le moment.</p>}
          </div>
        </section>
      ) : (
      <section className="useful-expo-schedule grand-palais-program-panel" aria-labelledby="grand-palais-venue-title">
        <div className="useful-expo-schedule-heading">
          <span className="step-label">{venue.heading}</span>
          <h3 id="grand-palais-venue-title">Expos en cours et à venir</h3>
          <p>Programmation prévisionnelle : les informations encore incertaines sont signalées.</p>
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
            <article
              key={`${entry.title}-${entry.period}`}
              className={[
                entry.uncertain ? "is-uncertain" : "",
                isGrandPalaisEntryCurrent(entry, today) ? "is-current" : "",
              ].filter(Boolean).join(" ")}
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
              {isGrandPalaisEntryCurrent(entry, today) ? (
                <em>En cours</em>
              ) : entry.uncertain ? (
                <em>À confirmer</em>
              ) : null}
            </article>
          ))}
        </div>

        <p className="useful-expo-source-note">
          Informations vérifiées sur le site du Grand Palais et complétées par les documents transmis.
          Les éléments prévisionnels peuvent évoluer.
        </p>
      </section>
      )}
    </section>
  );
}
