import type { PayStatus } from "./appModel";

export type CetCategory = "A" | "B" | "C";
export type CetEmployer = "ministry" | "public-establishment";
export type CetWorkRule =
  | "administrative"
  | "night_security"
  | "day_security"
  | "fire_12h"
  | "fire_24h"
  | "visitor_service"
  | "gtb_day"
  | "gtb_night"
  | "nurse"
  | "audiovisual_operations"
  | "visitor_service_assistant"
  | "cashier"
  | "pass_office"
  | "room_management"
  | "president_driver"
  | "part_time_90"
  | "part_time_80"
  | "part_time_70"
  | "part_time_60"
  | "part_time_50";
export type CetOperationKind =
  | "deposit"
  | "leave"
  | "indemnity"
  | "rafp"
  | "adjustment";
export type CetDepositSource = "annual" | "rtt" | "fraction";

export type CetOperation = {
  id: string;
  date: string;
  kind: CetOperationKind;
  days: number;
  source?: CetDepositSource;
  note?: string;
};

export type CetAccount = {
  enabled: boolean;
  employer: CetEmployer;
  employerName: string;
  category: CetCategory;
  workRule: CetWorkRule;
  hasOneYearService: boolean;
  isTrainee: boolean;
  openedOn: string;
  initialBalance: number;
  /** Un solde acquis au titre du relèvement exceptionnel de 2024 peut rester
   * supérieur au plafond ordinaire de 60 jours. Il n'ouvre pas un nouveau
   * droit à alimenter au-delà de ce solde. */
  legacyCap70: boolean;
  operations: CetOperation[];
};

export type CetStoredAccount = {
  enabled?: unknown;
  employer?: unknown;
  employer_name?: unknown;
  category?: unknown;
  work_rule?: unknown;
  has_one_year_service?: unknown;
  is_trainee?: unknown;
  opened_on?: unknown;
  initial_balance?: unknown;
  legacy_cap_70?: unknown;
  operations?: unknown;
};

export const CET_INDEMNITY_RATES: Record<CetCategory, number> = {
  A: 150,
  B: 100,
  C: 83,
};
export const CET_OPTION_THRESHOLD = 15;
export const CET_ORDINARY_CAP = 60;
export const CET_MAX_ANNUAL_PROGRESSION = 10;

export type CetWorkRuleDetails = {
  label: string;
  minimumAnnualDaysTaken: number;
  maximumAnnualDeposit: number;
  maximumRttDeposit: number;
};

/** Barème transmis par le Centre Pompidou. Les jours de fractionnement
 * s'ajoutent aux maxima CA/RTT indiqués dans le tableau. */
export const CET_WORK_RULES: Record<CetWorkRule, CetWorkRuleDetails> = {
  administrative: { label: "Horaires administratifs", minimumAnnualDaysTaken: 20, maximumAnnualDeposit: 12, maximumRttDeposit: 12 },
  night_security: { label: "Sûreté de nuit", minimumAnnualDaysTaken: 15, maximumAnnualDeposit: 9, maximumRttDeposit: 9 },
  day_security: { label: "Sûreté de jour", minimumAnnualDaysTaken: 15, maximumAnnualDeposit: 9, maximumRttDeposit: 3 },
  fire_12h: { label: "Sécurité incendie - 12 heures", minimumAnnualDaysTaken: 12, maximumAnnualDeposit: 8, maximumRttDeposit: 0 },
  fire_24h: { label: "Sécurité incendie - 24 heures", minimumAnnualDaysTaken: 6, maximumAnnualDeposit: 4, maximumRttDeposit: 0 },
  visitor_service: { label: "Accueil et surveillance / accueil général", minimumAnnualDaysTaken: 18, maximumAnnualDeposit: 11, maximumRttDeposit: 15 },
  gtb_day: { label: "GTB jour", minimumAnnualDaysTaken: 12, maximumAnnualDeposit: 7, maximumRttDeposit: 0 },
  gtb_night: { label: "GTB nuit", minimumAnnualDaysTaken: 14, maximumAnnualDeposit: 9, maximumRttDeposit: 0 },
  nurse: { label: "Infirmiers", minimumAnnualDaysTaken: 16, maximumAnnualDeposit: 11, maximumRttDeposit: 7 },
  audiovisual_operations: { label: "Cellule exploitation audiovisuelle", minimumAnnualDaysTaken: 16, maximumAnnualDeposit: 11, maximumRttDeposit: 4 },
  visitor_service_assistant: { label: "Assistants au chef du service accueil du public", minimumAnnualDaysTaken: 18, maximumAnnualDeposit: 12, maximumRttDeposit: 10 },
  cashier: { label: "Agents de caisse", minimumAnnualDaysTaken: 15, maximumAnnualDeposit: 9, maximumRttDeposit: 10 },
  pass_office: { label: "Bureau des laissez-passer", minimumAnnualDaysTaken: 16, maximumAnnualDeposit: 11, maximumRttDeposit: 4 },
  room_management: { label: "Régie des salles", minimumAnnualDaysTaken: 20, maximumAnnualDeposit: 12, maximumRttDeposit: 0 },
  president_driver: { label: "Chauffeurs du Président", minimumAnnualDaysTaken: 9, maximumAnnualDeposit: 6, maximumRttDeposit: 0 },
  part_time_90: { label: "Temps partiel 90 % - 4,5 jours/semaine", minimumAnnualDaysTaken: 18, maximumAnnualDeposit: 11, maximumRttDeposit: 10 },
  part_time_80: { label: "Temps partiel 80 % - 4 jours/semaine", minimumAnnualDaysTaken: 15, maximumAnnualDeposit: 10, maximumRttDeposit: 9 },
  part_time_70: { label: "Temps partiel 70 % - 3,5 jours/semaine", minimumAnnualDaysTaken: 14, maximumAnnualDeposit: 8, maximumRttDeposit: 8 },
  part_time_60: { label: "Temps partiel 60 % - 3 jours/semaine", minimumAnnualDaysTaken: 11, maximumAnnualDeposit: 8, maximumRttDeposit: 7 },
  part_time_50: { label: "Temps partiel 50 % - 2,5 jours/semaine", minimumAnnualDaysTaken: 10, maximumAnnualDeposit: 6, maximumRttDeposit: 6 },
};

const kinds = new Set<CetOperationKind>([
  "deposit",
  "leave",
  "indemnity",
  "rafp",
  "adjustment",
]);
const sources = new Set<CetDepositSource>(["annual", "rtt", "fraction"]);

export function emptyCetAccount(): CetAccount {
  return {
    enabled: true,
    employer: "public-establishment",
    employerName: "Centre Pompidou",
    category: "C",
    workRule: "visitor_service",
    hasOneYearService: true,
    isTrainee: false,
    openedOn: "",
    initialBalance: 0,
    legacyCap70: false,
    operations: [],
  };
}

export function cetAccountFromApi(value: unknown): CetAccount | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as CetStoredAccount;
  const operations = Array.isArray(raw.operations)
    ? raw.operations.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const operation = candidate as Record<string, unknown>;
        if (
          typeof operation.id !== "string" ||
          typeof operation.date !== "string" ||
          !kinds.has(operation.kind as CetOperationKind) ||
          typeof operation.days !== "number" ||
          !Number.isFinite(operation.days)
        )
          return [];
        const source = sources.has(operation.source as CetDepositSource)
          ? (operation.source as CetDepositSource)
          : undefined;
        return [{
          id: operation.id,
          date: operation.date,
          kind: operation.kind as CetOperationKind,
          days: operation.days,
          source,
          note: typeof operation.note === "string" ? operation.note : undefined,
        }];
      })
    : [];
  return {
    enabled: raw.enabled !== false,
    employer: "public-establishment",
    employerName: "Centre Pompidou",
    category: "C",
    workRule: "visitor_service",
    hasOneYearService: true,
    isTrainee: false,
    openedOn: typeof raw.opened_on === "string" ? raw.opened_on : "",
    initialBalance:
      typeof raw.initial_balance === "number" &&
      Number.isFinite(raw.initial_balance)
        ? raw.initial_balance
        : 0,
    legacyCap70: raw.legacy_cap_70 === true,
    operations,
  };
}

export function cetBalance(account: CetAccount) {
  return account.operations.reduce((balance, operation) => {
    if (operation.kind === "deposit") return balance + operation.days;
    if (operation.kind === "adjustment") return balance + operation.days;
    return balance - operation.days;
  }, account.initialBalance);
}

export function cetYearEndSummary(
  account: CetAccount,
  status: PayStatus,
) {
  const balance = Math.max(0, cetBalance(account));
  const protectedDays = Math.min(balance, CET_OPTION_THRESHOLD);
  const optionDays = Math.max(0, balance - CET_OPTION_THRESHOLD);
  const indemnityRate = CET_INDEMNITY_RATES[account.category];
  return {
    balance,
    protectedDays,
    optionDays,
    indemnityRate,
    estimatedIndemnity: optionDays * indemnityRate,
    canUseRafp: status === "fonctionnaire",
  };
}

export function cetDepositCapacity(currentBalance: number) {
  const nonNegativeBalance = Math.max(0, currentBalance);
  const cap = Math.max(CET_ORDINARY_CAP, nonNegativeBalance);
  const roomUnderCap = Math.max(0, cap - nonNegativeBalance);
  const roomBeforeThreshold = Math.max(
    0,
    CET_OPTION_THRESHOLD - nonNegativeBalance,
  );
  return Math.min(
    roomUnderCap,
    roomBeforeThreshold + CET_MAX_ANNUAL_PROGRESSION,
  );
}

export function cetAvailableWholeDays(values: {
  annual: number;
  rtt: number;
  fraction: number;
}) {
  return {
    annual: Math.max(0, Math.floor(values.annual)),
    rtt: Math.max(0, Math.floor(values.rtt)),
    fraction: Math.max(0, Math.floor(values.fraction)),
  };
}

export function cetDepositEligibility(
  annualDaysTaken: number,
  minimumAnnualDaysTaken = 20,
) {
  return annualDaysTaken >= minimumAnnualDaysTaken
    ? { eligible: true as const, missingDays: 0 }
    : {
        eligible: false as const,
        missingDays: Math.max(0, minimumAnnualDaysTaken - annualDaysTaken),
      };
}

export function cetDepositWindow(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return { open: false, year: 0 };
  const year = Number(match[1]);
  return {
    open: dateKey >= `${year}-11-15` && dateKey <= `${year}-12-31`,
    year,
  };
}

export function cetDepositsForYear(account: CetAccount, year: number) {
  return account.operations.filter(
    (operation) =>
      operation.kind === "deposit" && operation.date.startsWith(`${year}-`),
  );
}

export function cetSourceDepositCapacity(
  account: CetAccount,
  source: CetDepositSource,
  availableWholeDays: number,
  dateKey: string,
) {
  const { year } = cetDepositWindow(dateKey);
  const rule = CET_WORK_RULES[account.workRule];
  const sourceMaximum = source === "annual"
    ? rule.maximumAnnualDeposit
    : source === "rtt"
      ? rule.maximumRttDeposit
      : 2;
  const alreadyDeposited = year
    ? cetDepositsForYear(account, year)
        .filter((operation) => operation.source === source)
        .reduce((total, operation) => total + operation.days, 0)
    : 0;
  return Math.max(
    0,
    Math.min(
      Math.floor(availableWholeDays),
      sourceMaximum - alreadyDeposited,
      cetDepositCapacity(cetBalance(account)),
    ),
  );
}

export function cetOptionCapacity(account: CetAccount) {
  return Math.max(0, cetBalance(account) - CET_OPTION_THRESHOLD);
}

export const CET_OPERATION_LABELS: Record<CetOperationKind, string> = {
  deposit: "Alimentation",
  leave: "Congé pris sur le CET",
  indemnity: "Indemnisation",
  rafp: "Versement RAFP",
  adjustment: "Correction du solde",
};

export const CET_SOURCE_LABELS: Record<CetDepositSource, string> = {
  annual: "Congés annuels",
  rtt: "RTT",
  fraction: "Fractionnement",
};
