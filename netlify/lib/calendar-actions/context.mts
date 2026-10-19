import type { getStore } from "@netlify/blobs";

export type CalendarActionContext = {
  body: Record<string, unknown>;
  request: Request;
  user: { id: string; email: string };
  store: ReturnType<typeof getStore>;
  scopedKey: (key: string) => string;
  entryPrefix: string;
  periodPrefix: string;
  overtimePrefix: string;
  recoveryUsePrefix: string;
  mecenatPrefix: string;
  /** Exécute une opération d’un lot, sans les effets de la requête
   *  d’origine (authentification, recopie vers le planning partagé). */
  runOperation: (request: Request) => Promise<Response>;
};
