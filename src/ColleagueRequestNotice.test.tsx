import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ColleagueExchangeRequestDialog, ColleagueRequestDialog, ColleagueReturnShareDialog } from "./ColleagueRequestNotice";

describe("notification de partage d’un planning", () => {
  it("propose clairement d’accepter ou de refuser", () => {
    const html = renderToStaticMarkup(<ColleagueRequestDialog
      request={{
        ownerId: "owner", viewerId: "viewer", ownerName: "Camille", viewerName: "Mika",
        status: "pending", createdAt: "2026-09-02", updatedAt: "2026-09-02",
      }}
      busy={false}
      onRespond={vi.fn()}
    />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Camille souhaite partager son planning avec vous");
    expect(html).toContain("Accepter");
    expect(html).toContain("Refuser");
  });

  it("utilise la même fenêtre intégrée pour proposer le partage en retour", () => {
    const html = renderToStaticMarkup(<ColleagueReturnShareDialog ownerName="Camille" busy={false} status="offer" onAccept={vi.fn()} onDecline={vi.fn()} onFinish={vi.fn()} />);
    expect(html).toContain("colleague-request-notice");
    expect(html).toContain("Partager aussi votre planning avec Camille");
    expect(html).toContain("Partager en retour");
    expect(html).toContain("Pas maintenant");
  });

  it("confirme clairement que le planning a été envoyé", () => {
    const html = renderToStaticMarkup(<ColleagueReturnShareDialog ownerName="Camille" busy={false} status="sent" onAccept={vi.fn()} onDecline={vi.fn()} onFinish={vi.fn()} />);
    expect(html).toContain("Votre planning a bien été envoyé");
    expect(html).toContain("Terminer");
  });

  it("affiche le motif pour lequel un échange proposé ne peut pas être inscrit", () => {
    const html = renderToStaticMarkup(<ColleagueExchangeRequestDialog
      request={{
        id: "exchange-1", fromId: "user-a", fromName: "Alice", fromGroup: 2, toId: "user-b", toName: "Benoît",
        agreementDate: "2026-11-12", returnDate: "2026-11-19", agreementStart: "", agreementEnd: "", returnStart: "", returnEnd: "",
        status: "pending", createdAt: "2026-10-01", updatedAt: "2026-10-01",
      }}
      busy={false}
      error="Une des dates comporte déjà un congé ou une récupération."
      onRespond={vi.fn()}
    />);
    expect(html).toContain("Alice vous propose un échange");
    expect(html).toContain('role="alert">Une des dates comporte déjà un congé ou une récupération.</span>');
  });
});
