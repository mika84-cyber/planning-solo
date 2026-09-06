import { useEffect, useState } from "react";
import { getColleagueDirectory, updateColleagueSharing, type ColleagueShare } from "./colleagueSharingApi";
import "./colleagueRequestNotice.css";

const demoIncomingRequest: ColleagueShare = {
  ownerId: "demo-agnes",
  viewerId: "demo-mika",
  ownerName: "Agnès",
  viewerName: "Mika",
  status: "pending",
  createdAt: "2026-09-04",
  updatedAt: "2026-09-04",
};

export function ColleagueRequestDialog({ request, busy, onRespond }: {
  request: ColleagueShare;
  busy: boolean;
  onRespond: (response: "accept" | "reject") => void;
}) {
  return (
    <aside className="colleague-request-notice" role="dialog" aria-modal="true" aria-labelledby="colleague-request-title">
      <div><strong id="colleague-request-title">{request.ownerName} souhaite partager son planning avec vous</strong><span>Voulez-vous pouvoir le consulter ?</span></div>
      <div className="colleague-request-actions"><button type="button" disabled={busy} onClick={() => onRespond("accept")}>Accepter</button><button className="secondary" type="button" disabled={busy} onClick={() => onRespond("reject")}>Refuser</button></div>
    </aside>
  );
}

export function ColleagueReturnShareDialog({ ownerName, busy, status, onAccept, onDecline, onFinish }: {
  ownerName: string;
  busy: boolean;
  status: "offer" | "sent" | "error";
  onAccept: () => void;
  onDecline: () => void;
  onFinish: () => void;
}) {
  const title = status === "sent"
    ? "Votre planning a bien été envoyé"
    : status === "error"
      ? "Le partage n’a pas pu être envoyé"
      : `Partager aussi votre planning avec ${ownerName} ?`;
  return (
    <aside className="colleague-request-notice colleague-return-share-notice" role="dialog" aria-modal="true" aria-labelledby="colleague-return-share-title">
      <div>
        <strong id="colleague-return-share-title">{title}</strong>
        <span>
          {status === "sent"
            ? `${ownerName} pourra désormais consulter votre planning.`
            : status === "error"
              ? `L’accès au planning de ${ownerName} est bien accepté. Vous pourrez réessayer d’envoyer le vôtre.`
              : `Vous pouvez maintenant autoriser ${ownerName} à consulter votre planning en retour.`}
        </span>
      </div>
      <div className="colleague-request-actions">
        {status === "sent" ? (
          <button type="button" onClick={onFinish}>Terminer</button>
        ) : status === "error" ? (
          <><button type="button" disabled={busy} onClick={onAccept}>Réessayer</button><button className="secondary" type="button" onClick={onFinish}>Plus tard</button></>
        ) : (
          <><button type="button" disabled={busy} onClick={onAccept}>{busy ? "Envoi…" : "Partager en retour"}</button><button className="secondary" type="button" disabled={busy} onClick={onDecline}>Pas maintenant</button></>
        )}
      </div>
    </aside>
  );
}

export function ColleagueRequestNotice({ demoMode, onOpen }: { demoMode: boolean; onOpen: () => void }) {
  const demoInvitation = demoMode && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("demo-share-invitation") === "1";
  const [request, setRequest] = useState<ColleagueShare | null>(() => demoInvitation ? demoIncomingRequest : null);
  const [returnShare, setReturnShare] = useState<{ request: ColleagueShare; status: "offer" | "sent" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await getColleagueDirectory();
        const pending = data.self.visible ? data.incoming.find((share) =>
          share.status === "pending" || share.status === "automatic",
        ) || null : null;
        if (active) setRequest(pending);
      } catch {
        // Le planning principal reste utilisable si cette vérification échoue.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [demoMode]);

  const respond = async (response: "accept" | "reject") => {
    if (!request) return;
    if (response === "reject" && !window.confirm(`Confirmer : refuser le planning partagé par ${request.ownerName} ?`)) return;
    setBusy(true);
    try {
      const updatedDirectory = demoMode
        ? null
        : await updateColleagueSharing({ action: "respond", ownerId: request.ownerId, response });
      setRequest(null);
      if (response === "accept") {
        const alreadySharingBack = updatedDirectory?.outgoing.some((share) =>
          share.viewerId === request.ownerId && share.status !== "blocked",
        ) || false;
        if (!alreadySharingBack) setReturnShare({ request, status: "offer" });
        else onOpen();
      }
    } catch {
      // La fenêtre reste ouverte pour permettre de réessayer si le réseau revient.
    } finally {
      setBusy(false);
    }
  };
  const shareBack = async () => {
    if (!returnShare) return;
    setBusy(true);
    try {
      if (!demoMode) await updateColleagueSharing({ action: "share", viewerId: returnShare.request.ownerId });
      setReturnShare((current) => current ? { ...current, status: "sent" } : null);
    } catch {
      setReturnShare((current) => current ? { ...current, status: "error" } : null);
    } finally {
      setBusy(false);
    }
  };
  const finishReturnShare = () => {
    setReturnShare(null);
    onOpen();
  };
  if (returnShare) return <ColleagueReturnShareDialog
    ownerName={returnShare.request.ownerName}
    busy={busy}
    status={returnShare.status}
    onAccept={() => void shareBack()}
    onDecline={finishReturnShare}
    onFinish={finishReturnShare}
  />;
  if (!request) return null;
  return <ColleagueRequestDialog request={request} busy={busy} onRespond={(response) => void respond(response)} />;
}
