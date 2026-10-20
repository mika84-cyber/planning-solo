import { useEffect, type TouchEvent } from "react";
import { localDate } from "./planningLogic";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { usePayUiState } from "./usePayUiState";

type PayMonthNavigationOptions = {
  payUi: Pick<ReturnType<typeof usePayUiState>, "setPayView" | "payMonthSlide" | "setPayMonthSlide" | "payMonthSlideTimer">;
  allowancesSwipeStart: ReturnType<typeof useAppShellUiState>["allowancesSwipeStart"];
};

/** Le mois affiché dans Ma paie : flèches, « Aujourd'hui », et le glissement
 *  horizontal de la carte des primes, animé sauf si l'animation est réduite. */
export function usePayMonthNavigation({ payUi, allowancesSwipeStart }: PayMonthNavigationOptions) {
  const { setPayView, payMonthSlide, setPayMonthSlide, payMonthSlideTimer } = payUi;
  // biome-ignore lint/correctness/useExhaustiveDependencies: au démontage, on annule le dernier minuteur en cours, lu à ce moment-là.
  useEffect(
    () => () => {
      if (payMonthSlideTimer.current)
        window.clearTimeout(payMonthSlideTimer.current);
    },
    [],
  );
  function changePayMonth(delta: 1 | -1) {
    setPayView((current) =>
      localDate(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }
  function goPayToday() {
    const today = new Date();
    setPayView(localDate(today.getFullYear(), today.getMonth(), 1));
  }
  function slideAllowancesMonth(delta: 1 | -1) {
    if (
      payMonthSlide ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      changePayMonth(delta);
      return;
    }
    if (payMonthSlideTimer.current)
      window.clearTimeout(payMonthSlideTimer.current);
    setPayMonthSlide(delta > 0 ? "out-left" : "out-right");
    payMonthSlideTimer.current = window.setTimeout(() => {
      changePayMonth(delta);
      setPayMonthSlide(delta > 0 ? "in-right" : "in-left");
      payMonthSlideTimer.current = window.setTimeout(() => {
        setPayMonthSlide("");
        payMonthSlideTimer.current = null;
      }, 190);
    }, 150);
  }
  function startAllowancesSwipe(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    allowancesSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function endAllowancesSwipe(event: TouchEvent<HTMLElement>) {
    if (!allowancesSwipeStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - allowancesSwipeStart.current.x;
    const deltaY = touch.clientY - allowancesSwipeStart.current.y;
    allowancesSwipeStart.current = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25)
      return;
    slideAllowancesMonth(deltaX < 0 ? 1 : -1);
  }

  return { changePayMonth, goPayToday, slideAllowancesMonth, startAllowancesSwipe, endAllowancesSwipe };
}
