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

export type GrandPalaisProgramPayload = {
  approved: SharedGrandPalaisEvent[];
  pending: GrandPalaisProgramProposal[];
  isAdmin: boolean;
  lastCheckedAt?: string;
};
