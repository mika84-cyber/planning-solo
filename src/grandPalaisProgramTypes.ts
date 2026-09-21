/** Un tarif publié : son nom tel quel, son montant en euros, et le dernier
 *  jour où il a cours quand il ne vaut que pour une date — un vernissage, une
 *  soirée. Passé ce jour, la carte ne le montre plus. */
export type GrandPalaisPrice = { label: string; amount: number; until?: string };

export type SharedGrandPalaisEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  url: string;
  venueKey: string;
  venueLabel: string;
  /** Tarifs lus dans la rubrique « Tarifs » de la fiche officielle, dans leur
   *  ordre et sous leur nom. */
  prices?: GrandPalaisPrice[];
  deleted?: boolean;
  approvedAt?: string;
};

export type GrandPalaisProgramProposal = {
  id: string;
  kind: "new" | "changed" | "removed";
  detectedAt: string;
  previous?: SharedGrandPalaisEvent;
  next?: SharedGrandPalaisEvent;
};

/** Une proposition écartée. Conservée pour distinguer un refus d'un
 *  événement jamais soumis, et ne pas revenir sur un choix déjà fait. */
export type GrandPalaisDismissal = {
  eventId: string;
  proposalId: string;
  title: string;
  startDate: string;
  dismissedAt: string;
};

/** Résultat du dernier contrôle des frontières, affiché à l'administratrice :
 *  un contrôle ne peut pas rendre compte par le canal qu'il teste. */
export type BoundaryReport = {
  checkedAt: string;
  boundaries: Array<{ name: string; ok: boolean; detail: string }>;
  lastDeliveryAt?: string;
  deliveryDetail?: string;
};

export type GrandPalaisProgramPayload = {
  approved: SharedGrandPalaisEvent[];
  pending: GrandPalaisProgramProposal[];
  isAdmin: boolean;
  lastCheckedAt?: string;
  health?: BoundaryReport;
};
