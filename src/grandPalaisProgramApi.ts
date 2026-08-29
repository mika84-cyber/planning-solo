import type {
  GrandPalaisProgramPayload,
  GrandPalaisProgramProposal,
} from "./grandPalaisProgramTypes";

export class GrandPalaisProgramApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "GrandPalaisProgramApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isSharedEvent(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.startDate === "string" &&
    typeof value.endDate === "string" &&
    typeof value.url === "string" &&
    typeof value.venueKey === "string" &&
    typeof value.venueLabel === "string" &&
    (value.deleted === undefined || typeof value.deleted === "boolean") &&
    isOptionalString(value.approvedAt)
  );
}

function isProposal(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.kind === "new" ||
      value.kind === "changed" ||
      value.kind === "removed") &&
    typeof value.detectedAt === "string" &&
    (value.previous === undefined || isSharedEvent(value.previous)) &&
    (value.next === undefined || isSharedEvent(value.next))
  );
}

function isProgramPayload(value: unknown): value is GrandPalaisProgramPayload {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.approved) &&
    value.approved.every(isSharedEvent) &&
    Array.isArray(value.pending) &&
    value.pending.every(isProposal) &&
    typeof value.isAdmin === "boolean" &&
    isOptionalString(value.lastCheckedAt)
  );
}

async function parse(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok)
    throw new GrandPalaisProgramApiError(
      (isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : undefined) || "La programmation partagée n’a pas pu être chargée.",
      response.status,
    );
  if (!isProgramPayload(payload))
    throw new GrandPalaisProgramApiError(
      "La réponse de programmation reçue est invalide.",
      502,
    );
  return payload;
}

export async function getSharedGrandPalaisProgram() {
  return parse(await fetch("/api/gp-program", {
    cache: "no-store",
    credentials: "same-origin",
  }));
}

export async function reviewGrandPalaisProposal(
  proposalId: GrandPalaisProgramProposal["id"],
  decision: "accept" | "ignore",
) {
  return parse(await fetch("/api/gp-program", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ proposalId, decision }),
  }));
}
