export type UsefulContactPhone = {
  label?: string;
  number: string;
  allowCall?: boolean;
};

export type UsefulContact = {
  id?: string;
  name: string;
  email?: string;
  phones?: UsefulContactPhone[];
  singleLineLabel?: boolean;
  context?: string;
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
