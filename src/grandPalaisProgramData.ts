import type { GrandPalaisPrice } from "./grandPalaisProgramTypes";
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
  /** Tarifs relevés sur la page officielle, dans leur ordre et sous leur nom :
   *  une exposition en annonce deux, un salon peut en annoncer quatre. Absents
   *  tant que le Grand Palais ne les publie pas : mieux vaut aucun tarif qu'un
   *  prix inventé. */
  prices?: GrandPalaisPrice[];
  /** Une condition écrite sous les tarifs de la fiche : location des patins
   *  incluse, billetterie qui n'ouvre qu'à une date. */
  priceNote?: string;
  uncertain?: boolean;
  officialUrl?: string;
  /** Le site tiers vers lequel le Grand Palais renvoie pour les tarifs ou la
   *  billetterie : la carte l'affiche, en plus de la fiche officielle. */
  ticketingUrl?: string;
  startsOn?: string;
  endsOn?: string;
  currentlyOpen?: boolean;
  /** L'audioguide de l'exposition : la page qu'ouvre son QR code, le code
   *  d'accès à y saisir et le QR code d'origine, à faire flasher. */
  audioguide?: { url: string; code: string; languages: string; qr: string };
};

/** Relevé sur la fiche officielle : plein, réduit, Billet Liberté (sans
 *  réservation jusqu'au 3 janvier 2027), puis à qui l'entrée est gratuite. */
/** Même mention sur les fiches de Cezanne, de Girls et de Mika Ninagawa. */
const UNDER_18_FREE: GrandPalaisPrice = { label: "Moins de 18 ans, demandeurs d’emploi, visiteurs en situation de handicap…", amount: 0 };

const CEZANNE_PRICES: GrandPalaisPrice[] = [
  { label: "Plein", amount: 19 },
  { label: "Réduit", amount: 16 },
  { label: "Billet Liberté", amount: 24 },
  UNDER_18_FREE,
];

const EXTRA_CHILD = "Enfant supplémentaire de moins de 12 ans (avec un billet famille)";

const TRANSPARENCE_PRICES: GrandPalaisPrice[] = [
  { label: "Plein", amount: 13 },
  { label: "Abonné", amount: 8 },
  { label: "Moins de 2 ans, demandeurs d’emploi, visiteurs en situation de handicap…", amount: 0 },
];

/** La patinoire de la Nef : trois grilles sur la fiche officielle (matin,
 *  après-midi, nocturne), gratuite pour les moins de 3 ans. Le titre, les
 *  dates et la fiche sont ceux du site : la veille nocturne reconnaît ainsi
 *  l'entrée et ne la propose pas une seconde fois. */
const GRAND_PALAIS_DE_GLACE_2026: GrandPalaisProgramEntry = {
  title: "Le Grand Palais de Glace 2026",
  period: "Du 12 décembre 2026 au 6 janvier 2027",
  startsOn: "2026-12-12",
  endsOn: "2027-01-06",
  officialUrl: "https://www.grandpalais.fr/fr/programme/le-grand-palais-de-glace-2026",
  ticketingUrl: "https://legrandpalaisdeglace.fr/billetterie/",
  prices: [
    { group: "Session du matin", label: "Adultes", amount: 27 },
    { group: "Session du matin", label: "Enfants", amount: 15 },
    { group: "Session du matin", label: "Seniors (65 ans et +)", amount: 22 },
    { group: "Session de l’après-midi", label: "Adultes", amount: 32 },
    { group: "Session de l’après-midi", label: "Enfants", amount: 18 },
    { group: "Session de l’après-midi", label: "Seniors (65 ans et +)", amount: 26 },
    { group: "Nocturne", label: "De 20h à 2h", amount: 39 },
    { group: "Nocturne", label: "De minuit à 2h", amount: 27 },
    { label: "Moins de 3 ans", amount: 0 },
  ],
  priceNote: "Location des patins à glace incluse (tailles 25 à 50)",
};

const CEZANNE_AUDIOGUIDE = {
  url: "https://audioguide.grandpalais.fr/bypass",
  code: "7268",
  languages: "Français et anglais",
  qr: "/useful-forms/audioguide-cezanne-qr.png",
};

/** Un titre réduit à ce qui le distingue : sans accents, chiffres, ponctuation,
 *  mots-outils ni pluriels. « Le Grand Palais des Glaces » et « Le Grand Palais
 *  de Glace 2026 » donnent la même clé : la fiche officielle et l'application
 *  n'écrivent pas toujours un titre à l'identique, et deux écritures du même
 *  événement ne doivent jamais donner deux cartes. */
export function grandPalaisTitleKey(title: string) {
  return title
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z]+/g, " ")
    .replace(/\b(?:les?|la|l|des?|du|d|et|aux?|une?|en|the|of|and|with|an?)\b/g, " ")
    .replace(/\b([a-z]{3,})s\b/g, "$1")
    .trim().replace(/ +/g, " ");
}

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
          prices: CEZANNE_PRICES,
          startsOn: "2026-09-23",
          endsOn: "2027-01-17",
          audioguide: CEZANNE_AUDIOGUIDE,
        },
      ],
      2027: [
        {
          title: "Cezanne et nous",
          period: "Jusqu’au 17 janvier 2027",
          details: "J-R Touzet · X. Rey · C. Bernardi · M. Gauthier",
          officialUrl: "https://www.grandpalais.fr/fr/programme/cezanne-et-nous",
          prices: CEZANNE_PRICES,
          startsOn: "2026-09-23",
          endsOn: "2027-01-17",
          audioguide: CEZANNE_AUDIOGUIDE,
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
          officialUrl: "https://www.grandpalais.fr/fr/programme/girls-adolescence-mode-rebellion",
          prices: [
            { label: "Plein", amount: 15 },
            { label: "Réduit", amount: 12 },
            UNDER_18_FREE,
          ],
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
          officialUrl: "https://www.grandpalais.fr/fr/programme/le-musee-imaginaire-doli",
          // La fiche officielle n'annonce pas de tarif : elle renvoie au site
          // de l'exposition, dont la billetterie ouvre le 26 octobre 2026.
          ticketingUrl: "https://lemuseeimaginairedoli.com",
          priceNote: "Ouverture de la billetterie le 26 octobre 2026",
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
        { title: "Fine Arts Paris", period: "Du 19 au 23 septembre 2026", startsOn: "2026-09-19", endsOn: "2026-09-23", officialUrl: "https://www.grandpalais.fr/fr/programme/fine-arts-paris-2026", prices: [{ label: "Plein", amount: 30 }, { label: "Réduit", amount: 25 }, { label: "Demi-tarif", amount: 15 }] },
        { title: "Art Basel", period: "Du 23 au 25 octobre 2026", startsOn: "2026-10-23", endsOn: "2026-10-25", officialUrl: "https://www.grandpalais.fr/fr/programme/art-basel-paris-2026", ticketingUrl: "https://www.artbasel.com/paris/tickets", prices: [{ label: "Billet jour", amount: 47 }, { label: "Billet jour, réduit", amount: 30 }, { label: "Billet soirée", amount: 40, until: "2026-10-23" }, { label: "Vernissage", amount: 120, until: "2026-10-22" }] },
        {
          title: "Paris Photo World Supreme",
          period: "Du 12 au 15 novembre 2026",
          startsOn: "2026-11-12",
          endsOn: "2026-11-15",
          officialUrl: "https://www.grandpalais.fr/fr/programme/paris-photo-2026",
          ticketingUrl: "https://www.parisphoto.com/fr-fr.html",
          prices: [
            { label: "Semaine", amount: 36 },
            { label: "Week-end", amount: 41 },
            { label: "Soirée", amount: 26 },
            { label: "Réduit étudiant", amount: 26 },
          ],
        },
        {
          title: "Arabian Horse Championship",
          period: "Du 25 au 27 novembre 2026",
          startsOn: "2026-11-25",
          endsOn: "2026-11-27",
          officialUrl: "https://www.grandpalais.fr/fr/programme/championnat-du-monde-du-cheval-arabe",
          ticketingUrl: "https://gcarabianstour.com/",
          prices: [
            { label: "Adulte · journée", amount: 15 },
            { label: "Adulte · 3 jours", amount: 35 },
            { label: "Enfant · journée", amount: 5 },
            { label: "Enfant · 3 jours", amount: 12 },
            { label: "Famille · journée", amount: 30 },
            { label: "Famille · 3 jours", amount: 75 },
            { label: `${EXTRA_CHILD} · journée`, amount: 5 },
            { label: `${EXTRA_CHILD} · 3 jours`, amount: 12 },
            { label: "Moins de 3 ans", amount: 0 },
          ],
        },
        // La fiche officielle n'annonce pas de tarif : « Informations et
        // réservations sur le site adoptai.artefact.com ».
        { title: "Adopt AI", period: "Les 3 et 4 décembre 2026", startsOn: "2026-12-03", endsOn: "2026-12-04", officialUrl: "https://www.grandpalais.fr/fr/programme/adopt-ai-2026", ticketingUrl: "https://adoptai.artefact.com/content/inscription" },
        GRAND_PALAIS_DE_GLACE_2026,
      ],
      2027: [
        { ...GRAND_PALAIS_DE_GLACE_2026, period: "Jusqu’au 6 janvier 2027" },
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
          officialUrl: "https://www.grandpalais.fr/fr/programme/mika-ninagawa-eim-alive-shadows",
          prices: [
            { label: "Plein", amount: 15 },
            { label: "Réduit", amount: 12 },
            UNDER_18_FREE,
          ],
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
          prices: TRANSPARENCE_PRICES,
          startsOn: "2025-06-20",
          endsOn: "2027-08-29",
        },
      ],
      2027: [
        {
          title: "Transparence",
          period: "Jusqu’au 29 août 2027",
          officialUrl: "https://www.grandpalais.fr/fr/programme/transparence",
          prices: TRANSPARENCE_PRICES,
          startsOn: "2025-06-20",
          endsOn: "2027-08-29",
        },
      ],
    },
  },
};
