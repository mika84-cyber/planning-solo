export type UsefulContactPhone = {
  label?: string;
  number: string;
  allowCall?: boolean;
  /** false : un portable sans bouton SMS (superviseurs, responsables). */
  allowSms?: boolean;
};

export type UsefulContact = {
  id?: string;
  name: string;
  email?: string;
  phones?: UsefulContactPhone[];
  singleLineLabel?: boolean;
  context?: string;
  /** Canal radio, montré à côté du nom : « Canal 2 ». */
  radioChannel?: number;
  /** Thème sous lequel l'annuaire GP-RMN range le contact : « Urgences ». */
  theme?: string;
};

export type PompidouContactSectionKey =
  | "ras"
  | "administration"
  | "rh"
  | "medical"
  | "it"
  | "tickets";

export type PompidouContactSection = {
  key: PompidouContactSectionKey;
  title: string;
  contacts: UsefulContact[];
};

/** Un code d'urgence à la radio : « FOX », « Alerte Feu ». */
export type UsefulRadioCode = { code: string; meaning: string };

export type UsefulContactsPayload = {
  pompidou: PompidouContactSection[];
  gprmn: UsefulContact[];
  /** Ajoutés par le serveur à chaque réponse, jamais enregistrés. */
  radioCodes?: UsefulRadioCode[];
};
