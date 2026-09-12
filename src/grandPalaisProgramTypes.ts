export type SharedGrandPalaisEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  url: string;
  venueKey: string;
  venueLabel: string;
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
