import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type {
  BoundaryReport,
  GrandPalaisDismissal,
  GrandPalaisProgramPayload,
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "../../src/grandPalaisProgramTypes.ts";
import type { GrandPalaisMonitorState } from "../lib/grandPalaisMonitor.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
    },
  });
}

function normalizedEmail(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function adminEmail() {
  return (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify?.env?.get("PROGRAM_ADMIN_EMAIL");
}

export default async function grandPalaisProgramHandler(request: Request) {
  if (!isTrustedMutation(request))
    return json({ error: "Origine de la requête non autorisée" }, 403);
  const user = await getUser();
  if (!user?.id || !user.email) return json({ error: "Connexion requise" }, 401);

  const isAdmin = Boolean(
    normalizedEmail(adminEmail())
    && normalizedEmail(user.email) === normalizedEmail(adminEmail()),
  );
  const store = getStore({ name: "planning-solo-program", consistency: "strong" });
  const [approvedValue, pendingValue, state, health] = await Promise.all([
    store.get("approved", { type: "json" }) as Promise<SharedGrandPalaisEvent[] | null>,
    store.get("pending", { type: "json" }) as Promise<GrandPalaisProgramProposal[] | null>,
    store.get("monitor-state", { type: "json" }) as Promise<GrandPalaisMonitorState | null>,
    store.get("health", { type: "json" }) as Promise<BoundaryReport | null>,
  ]);
  const approved = approvedValue ?? [];
  const pending = pendingValue ?? [];

  const payload = (nextApproved = approved, nextPending = pending): GrandPalaisProgramPayload => ({
    approved: nextApproved,
    pending: isAdmin ? nextPending : [],
    isAdmin,
    lastCheckedAt: state?.lastCheckedAt,
    // Le contrôle des frontières ne regarde que l'administratrice : c'est
    // elle qui peut agir, et le détail nomme des variables de configuration.
    health: isAdmin ? (health ?? undefined) : undefined,
  });

  if (request.method === "GET") return json(payload());
  if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!isAdmin) return json({ error: "Cette validation est réservée au compte administrateur" }, 403);

  const body = await request.json().catch(() => null) as {
    proposalId?: string;
    decision?: "accept" | "ignore";
  } | null;
  if (!body?.proposalId || !["accept", "ignore"].includes(body.decision || ""))
    return json({ error: "Décision invalide" }, 400);
  const proposal = pending.find((item) => item.id === body.proposalId);
  if (!proposal) return json({ error: "Cette proposition n’est plus disponible" }, 404);

  let nextApproved = approved;
  if (body.decision === "accept") {
    const source = proposal.kind === "removed" ? proposal.previous : proposal.next;
    if (!source)
      return json({ error: "Cette proposition est incomplète" }, 400);
    const accepted = {
      ...source,
      deleted: proposal.kind === "removed",
      approvedAt: new Date().toISOString(),
    };
    nextApproved = [...approved.filter((event) => event.id !== accepted.id), accepted];
  }
  const nextPending = pending.filter((item) => item.id !== proposal.id);
  // Un refus laissait le même état qu'un événement jamais vu : impossible
  // ensuite de savoir si l'on avait oublié de proposer ou si le choix avait
  // été fait. On le note, et l'amorçage d'une mémoire vide s'en sert pour ne
  // pas revenir sur un refus déjà exprimé.
  const writes = [
    store.setJSON("approved", nextApproved),
    store.setJSON("pending", nextPending),
  ];
  if (body.decision === "ignore") {
    const refused = proposal.next ?? proposal.previous;
    if (refused) {
      const dismissed = (await store.get("dismissed", { type: "json" }) as GrandPalaisDismissal[] | null) ?? [];
      writes.push(store.setJSON("dismissed", [
        ...dismissed.filter((item) => item.eventId !== refused.id),
        {
          eventId: refused.id,
          proposalId: proposal.id,
          title: refused.title,
          startDate: refused.startDate,
          dismissedAt: new Date().toISOString(),
        },
      ]));
    }
  }
  await Promise.all(writes);
  return json(payload(nextApproved, nextPending));
}

export const config = { path: "/api/gp-program" };
