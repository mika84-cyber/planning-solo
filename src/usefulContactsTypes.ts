export type UsefulContactPhone = {
  label?: string;
  number: string;
  allowCall?: boolean;
};

export type UsefulContact = {
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

export type UsefulContactsPayload = {
  pompidou: PompidouContactSection[];
  gprmn: UsefulContact[];
};
