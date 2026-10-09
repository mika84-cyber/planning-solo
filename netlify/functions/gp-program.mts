import { getStore } from "@netlify/blobs";
import { currentUser } from "../lib/identityUser.mts";
import type {
  BoundaryReport,
  GrandPalaisDismissal,
  GrandPalaisCheckReport,
  GrandPalaisSitePrices,
  GrandPalaisProgramPayload,
  GrandPalaisProgramProposal,
  SharedGrandPalaisEvent,
} from "../../src/grandPalaisProgramTypes.ts";
import type { GrandPalaisMonitorState } from "../lib/grandPalaisMonitor.mts";
import { isTrustedMutation } from "../lib/requestSecurity.mts";
import { CHECK_REPORT_KEY, CHECK_REQUEST_KEY, SITE_PRICES_KEY } from "../lib/grandPalaisCheck.mts";

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
  const user = await currentUser();
  if (!user?.id || !user.email) return json({ error: "Connexion requise" }, 401);

  const isAdmin = Boolean(
    normalizedEmail(adminEmail())
    && normalizedEmail(user.email) === normalizedEmail(adminEmail()),
  );
  const store = getStore({ name: "planning-solo-program", consistency: "strong" });
  const [approvedValue, pendingValue, state, health, sitePrices, lastCheckReport] = await Promise.all([
    store.get("approved", { type: "json" }) as Promise<SharedGrandPalaisEvent[] | null>,
    store.get("pending", { type: "json" }) as Promise<GrandPalaisProgramProposal[] | null>,
    store.get("monitor-state", { type: "json" }) as Promise<GrandPalaisMonitorState | null>,
    store.get("health", { type: "json" }) as Promise<BoundaryReport | null>,
    store.get(SITE_PRICES_KEY, { type: "json" }) as Promise<GrandPalaisSitePrices[] | null>,
    store.get(CHECK_REPORT_KEY, { type: "json" }) as Promise<GrandPalaisCheckReport | null>,
  ]);
  const approved = approvedValue ?? [];
  const pending = pendingValue ?? [];

  const payload = (nextApproved = approved, nextPending = pending): GrandPalaisProgramPayload => ({
    approved: nextApproved,
    pending: isAdmin ? nextPending : [],
    isAdmin,
    lastCheckedAt: state?.lastCheckedAt,
    // Le contrôle des frontières ne regarde que l'administrateur : c'est
    // elle qui peut agir, et le détail nomme des variables de configuration.
    health: isAdmin ? (health ?? undefined) : undefined,
    sitePrices: sitePrices ?? [],
    lastCheckReport: isAdmin ? (lastCheckReport ?? undefined) : undefined,
  });

  if (request.method === "GET") return json(payload());
  // L’administrateur peut effacer le dernier contrôle des alertes. Le
  // prochain contrôle du lundi le recrée, preuve de livraison comprise.
  if (request.method === "DELETE") {
    if (!isAdmin) return json({ error: "Cette suppression est réservée au compte administrateur" }, 403);
    await store.delete("health");
    return json({ ...payload(), health: undefined });
  }
  if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!isAdmin) return json({ error: "Cette validation est réservée au compte administrateur" }, 403);

  const body = await request.json().catch(() => null) as {
    action?: "run-check";
    proposalId?: string;
    decision?: "accept" | "ignore";
  } | null;
  // Contrôle du site lancé à la main : la demande est notée, puis la
  // fonction d'arrière-plan, qui ne fait rien sans elle, est réveillée. Le
  // résultat se lit ensuite dans `lastCheckedAt`.
  if (body?.action === "run-check") {
    const requestedAt = new Date().toISOString();
    await store.setJSON(CHECK_REQUEST_KEY, { at: requestedAt });
    try {
      const started = await fetch(new URL("/.netlify/functions/gp-program-check-background", request.url), { method: "POST" });
      if (!started.ok && started.status !== 202) throw new Error(`Statut ${started.status}`);
    } catch (error) {
      console.warn("Contrôle manuel du Grand Palais non lancé", error instanceof Error ? error.message : error);
      return json({ error: "Le contrôle n’a pas pu être lancé. Réessayez dans un instant." }, 502);
    }
    return json({ ...payload(), checkRequestedAt: requestedAt });
  }
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
