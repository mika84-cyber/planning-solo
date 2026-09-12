/** Le programme du Grand Palais livré avec l'application.
 *
 *  Séparé du composant pour que la surveillance du site officiel puisse s'y
 *  référer : sans cela elle tenait sa propre liste, qui prenait du retard et
 *  proposait des expositions déjà affichées par l'application.
 */
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

export type GrandPalaisVenue = {
  label: string;
  heading: string;
  schedule: Partial<Record<GrandPalaisProgramYear, GrandPalaisProgramEntry[]>>;
};

export type GrandPalaisProgramData = Record<string, GrandPalaisVenue>;

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
          officialUrl: "https://www.grandpalais.fr/fr/programme/transparence",
          startsOn: "2025-06-20",
          endsOn: "2027-08-29",
        },
      ],
      2027: [
        {
          title: "Transparence",
          period: "Jusqu’au 29 août 2027",
          officialUrl: "https://www.grandpalais.fr/fr/programme/transparence",
          startsOn: "2025-06-20",
          endsOn: "2027-08-29",
        },
      ],
    },
  },
};
