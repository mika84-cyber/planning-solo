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

export type GrandPalaisProgramPayload = {
  approved: SharedGrandPalaisEvent[];
  pending: GrandPalaisProgramProposal[];
  isAdmin: boolean;
  lastCheckedAt?: string;
};
