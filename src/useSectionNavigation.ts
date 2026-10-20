import { useEffect, useEffectEvent, type TouchEvent } from "react";
import { MAIN_SECTION_ORDER, type MainSection } from "./AppNavigation";
import type { useAppShellUiState } from "./useAppShellUiState";
import type { usePayUiState } from "./usePayUiState";

type SectionNavigationOptions = {
  appShellUi: Pick<
    ReturnType<typeof useAppShellUiState>,
    "homeSection" | "setHomeSection" | "mainMenuOpen" | "setMainMenuOpen" | "accountMenuOpen" | "setAccountMenuOpen" | "feedbackOpen" | "setFeedbackOpen" | "sectionSwipeStartRef"
  >;
  setPayScreen: ReturnType<typeof usePayUiState>["setPayScreen"];
};

/** Le passage d'une rubrique à l'autre : depuis le menu, par un glissement
 *  horizontal, ou par le bouton Retour, chaque rubrique ayant son entrée
 *  dans l'historique. */
export function useSectionNavigation({ appShellUi, setPayScreen }: SectionNavigationOptions) {
  const {
    homeSection, setHomeSection, mainMenuOpen, setMainMenuOpen,
    accountMenuOpen, setAccountMenuOpen, feedbackOpen, setFeedbackOpen, sectionSwipeStartRef,
  } = appShellUi;
  function startSectionSwipe(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "input, textarea, select, [role='dialog'], .modal-backdrop, .main-menu-backdrop, .main-menu-drawer, .choice-picker-menu, .month-card, .pay-dashboard-motion, .pay-dedicated-content, .pay-detail-sticky-header, .variable-pay-heading-actions",
      )
    ) {
      sectionSwipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    sectionSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function navigateFromShell(section: MainSection, record = true) {
    if (section === homeSection) return;
    if (record) history.pushState({ ...(history.state || {}), planningSection: section }, "", location.href);
    setHomeSection(section);
    if (section === "pay") setPayScreen("overview");
    setMainMenuOpen(false);
    setAccountMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const navigateBackTo = useEffectEvent((section: MainSection) => navigateFromShell(section, false));
  useEffect(() => {
    if (!MAIN_SECTION_ORDER.includes(history.state?.planningSection))
      history.replaceState({ ...(history.state || {}), planningSection: homeSection }, "", location.href);
    const onPopState = (event: PopStateEvent) => {
      if (mainMenuOpen) { setMainMenuOpen(false); return; }
      if (accountMenuOpen) { setAccountMenuOpen(false); return; }
      if (feedbackOpen) { setFeedbackOpen(false); return; }
      const section = event.state?.planningSection;
      if (MAIN_SECTION_ORDER.includes(section)) navigateBackTo(section);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [accountMenuOpen, feedbackOpen, homeSection, mainMenuOpen, setMainMenuOpen, setAccountMenuOpen, setFeedbackOpen]);

  function finishSectionSwipe(event: TouchEvent<HTMLElement>) {
    const start = sectionSwipeStartRef.current;
    sectionSwipeStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;

    const currentIndex = MAIN_SECTION_ORDER.indexOf(homeSection === "forms" ? "pdf" : homeSection);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextSection = MAIN_SECTION_ORDER[nextIndex];
    if (!nextSection) return;

    navigateFromShell(nextSection);
  }

  return { startSectionSwipe, finishSectionSwipe, navigateFromShell };
}
