import { useEffect, useState } from "react";

const CELEBRATION_DURATION_MS = 4_500;

/** Décoration temporaire affichée uniquement après une comparaison conforme. */
export function PayslipSuccessCelebration({
  durationMs = CELEBRATION_DURATION_MS,
}: {
  durationMs?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisible(false),
      durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className="payslip-success-celebration" aria-hidden="true">
      <img
        src="/payslip-success-money-fast.webp"
        alt=""
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
