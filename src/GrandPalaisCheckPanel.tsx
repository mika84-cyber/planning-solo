import { useEffect, useRef, useState } from "react";
import { euros } from "./appModel";
import { getSharedGrandPalaisProgram, runGrandPalaisCheckNow } from "./grandPalaisProgramApi";
import type { GrandPalaisCheckReport, GrandPalaisPrice, GrandPalaisProgramPayload } from "./grandPalaisProgramTypes";

/** Délai entre deux relectures pendant un contrôle lancé à la main ; la
 *  première vient plus tôt, un site injoignable se sachant en une seconde. */
const POLL_MS = 10_000;
const FIRST_POLL_MS = 4_000;
/** Au-delà, le contrôle est considéré comme n'ayant pas abouti. */
const GIVE_UP_MS = 4 * 60_000;

/** « jeudi 8 octobre 2026 à 16 h 05 ». */
export function checkDateLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const day = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ");
  return `${day} à ${time.replace(/^0/, "")}`;
}

/** « Plein tarif 32,00 €, Réduit 26,00 € » ; une grille nommée garde son
 *  nom devant chacun de ses tarifs : « Session du matin · Adultes 27,00 € ». */
const priceList = (prices: GrandPalaisPrice[]) =>
  prices.map((price) => `${price.group ? `${price.group} · ` : ""}${price.label} ${price.amount ? euros(price.amount) : "gratuit"}`).join(", ");

const PROPOSAL_LABELS: Record<GrandPalaisCheckReport["proposals"][number]["kind"], string> = {
  new: "Nouveauté",
  changed: "Modification",
  removed: "Retiré du site",
};

/** Ce que le dernier contrôle a ajouté de lui-même, puis ce qui attend
 *  l'accord de l'administrateur ; ou, à défaut, qu'il n'a rien trouvé. */
export function CheckReport({ report }: { report: GrandPalaisCheckReport }) {
  const added = [
    ...report.prices.map((item) => ({
      key: `price-${item.title}`,
      text: `${item.kind === "new" ? "Tarifs ajoutés" : "Tarifs mis à jour"} pour « ${item.title} » : ${priceList(item.prices)}.`,
    })),
    ...report.details.map((item) => ({ key: `details-${item.title}`, text: `Sous-titre de « ${item.title} » : ${item.details}.` })),
  ];
  if (!added.length && !report.proposals.length)
    return <p className="grand-palais-check-report">Rien de nouveau sur le site lors de ce contrôle.</p>;
  return (
    <div className="grand-palais-check-report">
      {added.length ? (
        <>
          <p><b>Ajouté par l’application</b></p>
          <ul>{added.map((item) => <li key={item.key}>{item.text}</li>)}</ul>
        </>
      ) : null}
      {report.proposals.length ? (
        <>
          <p><b>À valider ci-dessous</b></p>
          <ul>
            {report.proposals.map((item) => (
              <li key={`${item.kind}-${item.title}`}>{PROPOSAL_LABELS[item.kind]} : « {item.title} »{item.venueLabel ? ` (${item.venueLabel})` : ""}.</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** « Cette nuit à 0 h 05 », « Aujourd’hui à 14 h 30 », « Hier à … » ou la
 *  date complète : la veille se lit d'un coup d'œil. */
export function checkWhenLabel(value: string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const dayKey = (moment: Date) => moment.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ").replace(/^0/, "");
  const hour = Number(date.toLocaleTimeString("fr-FR", { hour: "2-digit", hour12: false, timeZone: "Europe/Paris" }).slice(0, 2));
  if (dayKey(date) === dayKey(now)) return `${hour < 6 ? "Cette nuit" : "Aujourd’hui"} à ${time}`;
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86_400_000))) return `Hier à ${time}`;
  return checkDateLabel(value).replace(/^./, (letter) => letter.toLocaleUpperCase("fr"));
}

/** L'heure (« 0 h 05 ») reste d'un seul tenant en fin de ligne. */
function CheckWhen({ label }: { label: string }) {
  const at = label.lastIndexOf(" à ");
  if (at < 0) return <>{label}</>;
  return <>{label.slice(0, at + 3)}<span className="gp-watch-time">{label.slice(at + 3)}</span></>;
}

/** Où en est le contrôle lancé à `requestedAt` : terminé dès que la date du
 *  dernier contrôle dépasse `before`, échoué si le serveur a noté un échec
 *  pour cette demande, sinon toujours en cours (`null`). */
export function checkProgress(
  payload: Pick<GrandPalaisProgramPayload, "lastCheckedAt" | "lastCheckFailure">,
  { before, requestedAt }: { before: string; requestedAt?: string },
): { status: "done" } | { status: "failed"; message: string } | null {
  if ((payload.lastCheckedAt || "") > before) return { status: "done" };
  const failure = payload.lastCheckFailure;
  if (requestedAt && failure?.requestedAt === requestedAt && typeof failure.message === "string")
    return { status: "failed", message: failure.message };
  return null;
}

/** Le résultat du dernier contrôle en quelques mots. */
function checkResultLabel(report?: GrandPalaisCheckReport) {
  if (!report) return "";
  const added = report.prices.length + report.details.length;
  const parts = [
    added ? `${added} mise${added > 1 ? "s" : ""} à jour ajoutée${added > 1 ? "s" : ""}` : "",
    report.proposals.length ? `${report.proposals.length} à valider` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "rien de nouveau";
}

/**
 * Veille du site du Grand Palais, pour l'administrateur : un petit radar
 * crème et terracotta — la date du dernier contrôle en grand, ce qu'il a
 * trouvé, et « Contrôler maintenant » : la veille ne tourne qu'à la main. Le
 * contrôle tourne en arrière-plan ; le panneau relit la programmation jusqu'à
 * voir la date changer, puis affiche le compte rendu.
 */
export function GrandPalaisCheckPanel({
  lastCheckedAt,
  report,
  onPayload,
}: {
  lastCheckedAt?: string;
  /** Compte rendu du dernier contrôle : tarifs ajoutés, nouveautés. */
  report?: GrandPalaisCheckReport;
  onPayload: (payload: GrandPalaisProgramPayload) => void;
}) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const runCheck = async () => {
    setStatus("running");
    setMessage("");
    const before = lastCheckedAt || "";
    const startedAt = Date.now();
    let requestedAt: string | undefined;
    try {
      const started = await runGrandPalaisCheckNow();
      requestedAt = started.checkRequestedAt;
      onPayload(started);
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Le contrôle n’a pas pu être lancé.");
      return;
    }
    const poll = async () => {
      try {
        const payload = await getSharedGrandPalaisProgram();
        const progress = checkProgress(payload, { before, requestedAt });
        if (progress) {
          onPayload(payload);
          setStatus(progress.status);
          setMessage(progress.status === "done" ? "Contrôle terminé." : progress.message);
          return;
        }
      } catch {}
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setStatus("failed");
        setMessage("Le contrôle n’a pas abouti. Le site du Grand Palais ne répond peut-être pas : réessayez plus tard.");
        return;
      }
      timer.current = window.setTimeout(() => void poll(), POLL_MS);
    };
    timer.current = window.setTimeout(() => void poll(), FIRST_POLL_MS);
  };

  const currentReport = report && report.checkedAt === lastCheckedAt ? report : undefined;
  const result = checkResultLabel(currentReport);
  const running = status === "running";
  const buttonLabel = running ? "Contrôle en cours…" : "Contrôler maintenant";
  const pending = !running && Boolean(result) && result !== "rien de nouveau";
  return (
    <section
      className={`grand-palais-check-panel gp-watch${running ? " is-running" : ""}${pending ? " has-news" : ""}`}
      aria-labelledby="grand-palais-check-title"
    >
      <div className="gp-watch-row">
        {/* Le radar : son faisceau tourne lentement, plus vite pendant une
            lecture ; un point s'allume quand le contrôle a trouvé du nouveau. */}
        <span className="gp-watch-scope" aria-hidden="true"><i /></span>
        <div className="gp-watch-text">
          <h3 id="grand-palais-check-title">Veille du site</h3>
          {lastCheckedAt ? (
            <>
              <small>Dernier contrôle</small>
              <strong className="gp-watch-when"><CheckWhen label={checkWhenLabel(lastCheckedAt)} /></strong>
            </>
          ) : <small>Aucun contrôle pour l’instant</small>}
          {running ? <span className="gp-watch-result">Lecture en cours…</span>
            : result ? (
              <span className={`gp-watch-result ${result === "rien de nouveau" ? "is-clear" : "is-pending"}`}>
                {result === "rien de nouveau" ? "Rien de nouveau" : result}
              </span>
            ) : null}
          <button type="button" className="grand-palais-check-button" disabled={running} aria-label={buttonLabel} onClick={() => void runCheck()}>
            {buttonLabel}
          </button>
        </div>
      </div>
      {running || message || (currentReport && result !== "rien de nouveau") ? (
        <div className="gp-watch-body">
          {running ? <p className="gp-watch-message" role="status">Lecture du site en cours, une à deux minutes…</p> : null}
          {message ? <p className="gp-watch-message" role={status === "failed" ? "alert" : "status"}>{message}</p> : null}
          {currentReport && !running && result !== "rien de nouveau" ? <CheckReport report={currentReport} /> : null}
        </div>
      ) : null}
    </section>
  );
}
