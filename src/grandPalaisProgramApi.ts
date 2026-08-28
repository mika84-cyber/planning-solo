import type {
  GrandPalaisProgramPayload,
  GrandPalaisProgramProposal,
} from "./grandPalaisProgramTypes";

class GrandPalaisProgramApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "GrandPalaisProgramApiError";
  }
}

async function parse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (GrandPalaisProgramPayload & { error?: string })
    | null;
  if (!response.ok)
    throw new GrandPalaisProgramApiError(
      payload?.error || "La programmation partagée n’a pas pu être chargée.",
      response.status,
    );
  return payload as GrandPalaisProgramPayload;
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
