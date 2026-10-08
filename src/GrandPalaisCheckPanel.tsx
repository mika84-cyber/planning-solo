import { useEffect, useRef, useState } from "react";
import { getSharedGrandPalaisProgram, runGrandPalaisCheckNow } from "./grandPalaisProgramApi";
import type { GrandPalaisProgramPayload } from "./grandPalaisProgramTypes";

/** Délai entre deux relectures pendant un contrôle lancé à la main. */
const POLL_MS = 10_000;
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

/**
 * Veille du site du Grand Palais, pour l'administrateur : la date du dernier
 * contrôle et un bouton pour en lancer un tout de suite. Le contrôle tourne en
 * arrière-plan ; le panneau relit la programmation jusqu'à voir la date
 * changer, puis affiche les éventuelles mises à jour détectées.
 */
export function GrandPalaisCheckPanel({
  lastCheckedAt,
  onPayload,
}: {
  lastCheckedAt?: string;
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
    try {
      onPayload(await runGrandPalaisCheckNow());
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Le contrôle n’a pas pu être lancé.");
      return;
    }
    const poll = async () => {
      try {
        const payload = await getSharedGrandPalaisProgram();
        if ((payload.lastCheckedAt || "") > before) {
          onPayload(payload);
          setStatus("done");
          setMessage(payload.pending.length
            ? "Contrôle terminé : des mises à jour attendent votre accord ci-dessous."
            : "Contrôle terminé : rien de nouveau à valider.");
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
    timer.current = window.setTimeout(() => void poll(), POLL_MS);
  };

  return (
    <section className="grand-palais-admin-alerts grand-palais-check-panel" aria-labelledby="grand-palais-check-title">
      <div>
        <span className="step-label">Réservé à votre compte</span>
        <h3 id="grand-palais-check-title">Veille du site</h3>
        <p>
          {lastCheckedAt
            ? <>Dernier contrôle du site du Grand Palais : <b>{checkDateLabel(lastCheckedAt)}</b>.</>
            : "Aucun contrôle du site enregistré pour l’instant."}{" "}
          Contrôle automatique chaque nuit à minuit.
        </p>
        <button type="button" className="grand-palais-check-button" disabled={status === "running"} onClick={() => void runCheck()}>
          {status === "running" ? "Contrôle en cours…" : "Lancer un contrôle maintenant"}
        </button>
        {status === "running" ? <p role="status">Lecture du site en cours, cela peut prendre une à deux minutes.</p> : null}
        {message ? <p role={status === "failed" ? "alert" : "status"}>{message}</p> : null}
      </div>
    </section>
  );
}
