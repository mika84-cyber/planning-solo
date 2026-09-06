import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteFeedback, dismissFeedbackResolution, getFeedbackInbox, getFeedbackSummary, replyToFeedback, resolveFeedback, sendFeedback } from "./feedbackApi";

describe("client de la messagerie interne", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envoie le retour et sa photo en JSON", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ sent: true, notified: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await sendFeedback({ kind: "bug", message: "Le bouton bloque", anonymous: true, photo: { contentType: "image/jpeg", contentBase64: "/9j/" } });
    expect(fetcher).toHaveBeenCalledWith("/api/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"anonymous":true'),
    }));
  });

  it("sépare la boîte administrateur, son compteur et les actions", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ unreadCount: 2, messages: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await getFeedbackInbox();
    await getFeedbackSummary();
    await resolveFeedback("message-1");
    await replyToFeedback("message-1", "Merci pour votre idée.");
    await deleteFeedback("message-1");
    await dismissFeedbackResolution("message-1");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/feedback",
      "/api/feedback?summary=1",
      "/api/feedback",
      "/api/feedback",
      "/api/feedback",
      "/api/feedback",
    ]);
    expect(fetcher.mock.calls[3]?.[1]?.body).toContain('"action":"reply"');
    expect(fetcher.mock.calls[3]?.[1]?.body).toContain("Merci pour votre idée.");
  });
});
