import { useEffect, useState } from "react";
import { colleagueObjectPronoun } from "./colleaguePronoun";
import { getColleagueDirectory, updateColleagueSharing, type ColleagueExchangeRequest, type ColleagueShare } from "./colleagueSharingApi";
import { addDays, dateKey, fromKey, getDayInfo, longDate } from "./planningLogic";
import "./colleagueRequestNotice.css";

/* Démo : Camille (groupe 1) propose un échange au groupe 2. Sa journée est
   un jour où elle travaille et où le groupe 2 est en repos ; la vôtre l'inverse. */
function demoExchangeRequest(): ColleagueExchangeRequest {
  let agreementDate = "", returnDate = "";
  for (let offset = 1; offset < 120 && !(agreementDate && returnDate); offset++) {
    const date = addDays(new Date(), offset);
    const mine = getDayInfo(date, 2), theirs = getDayInfo(date, 1);
    if (mine.holiday || theirs.holiday) continue;
    if (!agreementDate && theirs.kind === "work" && mine.kind === "off") agreementDate = dateKey(date);
    else if (agreementDate && !returnDate && mine.kind === "work" && theirs.kind === "off") returnDate = dateKey(date);
  }
  return {
    id: "demo-exchange-camille", fromId: "demo-camille", fromName: "Camille Durand", fromGroup: 1, toId: "demo-mika", toName: "Mika",
    agreementDate, returnDate, agreementStart: "10:00", agreementEnd: "18:00", returnStart: "10:00", returnEnd: "18:00",
    status: "pending", createdAt: "2026-09-04", updatedAt: "2026-09-04",
  };
}

/** « de 10 h à 18 h 30 » */
function hoursLabel(start: string, end: string) {
  const hour = (value: string) => value.replace(/^(\d{2}):(\d{2})$/, (_, h: string, m: string) => `${Number(h)} h${m === "00" ? "" : ` ${m}`}`);
  return start && end ? `de ${hour(start)} à ${hour(end)}` : "";
}

export function ColleagueExchangeRequestDialog({ request, busy, error, onRespond }: {
  request: ColleagueExchangeRequest;
  busy: boolean;
  error: string;
  onRespond: (response: "accept" | "decline") => void;
}) {
  const hours = hoursLabel(request.agreementStart, request.agreementEnd);
  return (
    <aside className="colleague-request-notice colleague-exchange-notice" role="dialog" aria-modal="true" aria-labelledby="colleague-exchange-title">
      <div>
        <strong id="colleague-exchange-title">{request.fromName} vous propose un échange</strong>
        <span>Vous travaillez à sa place le {longDate(fromKey(request.agreementDate))}{hours ? `, ${hours}` : ""}.</span>
        <span>{request.fromName} vous remplace le {longDate(fromKey(request.returnDate))}.</span>
        <span>Si vous acceptez, l’échange s’inscrit dans votre planning.</span>
        {error ? <span className="colleague-request-error" role="alert">{error}</span> : null}
      </div>
      <div className="colleague-request-actions">
        <button type="button" disabled={busy} onClick={() => onRespond("accept")}>{busy ? "Enregistrement…" : "Accepter"}</button>
        <button className="secondary" type="button" disabled={busy} onClick={() => onRespond("decline")}>Refuser</button>
      </div>
    </aside>
  );
}

export function ColleagueExchangeResultDialog({ request, onClose }: { request: ColleagueExchangeRequest; onClose: () => void }) {
  const accepted = request.status === "accepted";
  const pronoun = colleagueObjectPronoun(request.toName);
  return (
    <aside className="colleague-request-notice colleague-exchange-notice" role="dialog" aria-modal="true" aria-labelledby="colleague-exchange-result-title">
      <div>
        <strong id="colleague-exchange-result-title">{request.toName} a {accepted ? "accepté" : "refusé"} votre échange</strong>
        <span>
          {accepted
            ? `${request.toName} vous remplace le ${longDate(fromKey(request.agreementDate))} ; vous ${pronoun} remplacez le ${longDate(fromKey(request.returnDate))}. L’échange est dans son planning.`
            : "L’échange reste dans votre planning : modifiez-le ou supprimez-le depuis « Mes échanges »."}
        </span>
      </div>
      <div className="colleague-request-actions"><button type="button" onClick={onClose}>OK</button></div>
    </aside>
  );
}

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

export function ColleagueRequestNotice({ demoMode, onOpen, onExchangeAccepted }: {
  demoMode: boolean;
  onOpen: () => void;
  /** Un échange accepté : le planning se relit (ou, en démo, s'inscrit sur place). */
  onExchangeAccepted?: (request: ColleagueExchangeRequest) => void;
}) {
  const demoParams = demoMode && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const demoInvitation = demoParams?.get("demo-share-invitation") === "1";
  const [request, setRequest] = useState<ColleagueShare | null>(() => demoInvitation ? demoIncomingRequest : null);
  const [exchangeRequest, setExchangeRequest] = useState<ColleagueExchangeRequest | null>(() => demoParams?.get("demo-exchange-request") === "1" ? demoExchangeRequest() : null);
  const [exchangeResult, setExchangeResult] = useState<ColleagueExchangeRequest | null>(null);
  const [exchangeError, setExchangeError] = useState("");
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
        if (!active) return;
        setRequest(pending);
        // Un échange proposé par un collègue, ou la réponse à l'un des vôtres.
        setExchangeRequest(data.exchangeRequests?.incoming[0] || null);
        setExchangeResult(data.exchangeRequests?.outgoing.find((item) => item.status !== "pending") || null);
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
  const respondExchange = async (response: "accept" | "decline") => {
    if (!exchangeRequest) return;
    if (response === "decline" && !window.confirm(`Confirmer : refuser l’échange proposé par ${exchangeRequest.fromName} ?`)) return;
    setBusy(true);
    setExchangeError("");
    try {
      if (!demoMode) await updateColleagueSharing({ action: "respond-exchange", id: exchangeRequest.id, response });
      setExchangeRequest(null);
      if (response === "accept") onExchangeAccepted?.(exchangeRequest);
    } catch (error) {
      setExchangeError(error instanceof Error ? error.message : "L’échange n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  };
  const closeExchangeResult = async () => {
    if (!exchangeResult) return;
    setExchangeResult(null);
    if (!demoMode) await updateColleagueSharing({ action: "clear-exchange-request", id: exchangeResult.id }).catch(() => undefined);
  };
  if (returnShare) return <ColleagueReturnShareDialog
    ownerName={returnShare.request.ownerName}
    busy={busy}
    status={returnShare.status}
    onAccept={() => void shareBack()}
    onDecline={finishReturnShare}
    onFinish={finishReturnShare}
  />;
  if (request) return <ColleagueRequestDialog request={request} busy={busy} onRespond={(response) => void respond(response)} />;
  if (exchangeRequest) return <ColleagueExchangeRequestDialog request={exchangeRequest} busy={busy} error={exchangeError} onRespond={(response) => void respondExchange(response)} />;
  if (exchangeResult) return <ColleagueExchangeResultDialog request={exchangeResult} onClose={() => void closeExchangeResult()} />;
  return null;
}
