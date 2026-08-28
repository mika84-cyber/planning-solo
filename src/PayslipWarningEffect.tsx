import { useEffect, useState } from "react";

const WARNING_EFFECT_DURATION_MS = 4_500;

/** Éclair temporaire affiché seulement lorsqu'un écart de paie est confirmé. */
export function PayslipWarningEffect({
  durationMs = WARNING_EFFECT_DURATION_MS,
}: {
  durationMs?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <>
      <div className="payslip-warning-effect" aria-hidden="true">
        <video
          src="/payslip-warning-lightning.mp4"
          autoPlay
          muted
          playsInline
          preload="metadata"
          onEnded={() => setVisible(false)}
        />
      </div>
      <div className="payslip-warning-caption" aria-hidden="true">
        <span>⚡</span>
        <span>
          <strong>Écart détecté dans le bulletin</strong>
          <small>Une information est à vérifier</small>
        </span>
      </div>
    </>
  );
}
