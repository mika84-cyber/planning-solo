import { useEffect } from "react";

const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Applique le piège de focus, Échap et le retour au déclencheur à la modale visible. */
export function useModalAccessibility() {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let previousFocus: HTMLElement | null = null;
    let previousOverflow = "";
    // Safari ne donne pas le focus au bouton touché ou cliqué : quand la
    // fenêtre s'ouvre, l'élément actif est alors la page elle-même. On retient
    // donc le dernier élément focalisable touché hors d'une fenêtre, pour y
    // revenir à la fermeture, comme sur les autres navigateurs.
    let lastPointerTarget: HTMLElement | null = null;
    // Une fenêtre ouverte depuis une autre (un formulaire depuis une rubrique
    // de Congés) : à sa fermeture, la main revient au bouton qui l'avait
    // ouverte, et non au premier bouton de la fenêtre du dessous. Le bouton
    // touché dans une fenêtre est retenu à part, tant qu'aucune touche du
    // clavier n'a suivi.
    const openers = new WeakMap<HTMLElement, HTMLElement>();
    let lastInnerPointerTarget: HTMLElement | null = null;
    const pointerdown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(FOCUSABLE) : null;
      if (!target) return;
      if (target.closest('[aria-modal="true"]')) lastInnerPointerTarget = target;
      else lastPointerTarget = target;
    };

    const activate = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')];
      const next = dialogs.at(-1) || null;
      if (next === activeDialog) return;
      if (!next) {
        activeDialog = null;
        document.body.style.overflow = previousOverflow;
        previousFocus?.focus();
        previousFocus = null;
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (!activeDialog) {
        previousFocus = active && active !== document.body ? active : lastPointerTarget;
        previousOverflow = document.body.style.overflow;
      } else if (activeDialog.isConnected) {
        const opener = lastInnerPointerTarget && activeDialog.contains(lastInnerPointerTarget) ? lastInnerPointerTarget : active;
        if (opener && activeDialog.contains(opener)) openers.set(activeDialog, opener);
      }
      lastInnerPointerTarget = null;
      activeDialog = next;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        if (!activeDialog) return;
        const opener = openers.get(activeDialog);
        openers.delete(activeDialog);
        if (opener?.isConnected) {
          opener.focus();
          if (document.activeElement === opener) return;
        }
        const preferred = activeDialog.querySelector<HTMLElement>(
          "[autofocus], input:not([disabled]), button:not([disabled])",
        );
        (preferred || activeDialog).focus();
      });
    };

    const keydown = (event: KeyboardEvent) => {
      lastInnerPointerTarget = null;
      if (!activeDialog) return;
      if (event.key === "Escape") {
        const close = activeDialog.querySelector<HTMLElement>(
          "[data-modal-close], .modal-close",
        );
        if (close) {
          event.preventDefault();
          close.click();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...activeDialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!focusable.length) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(activate);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", pointerdown, true);
    activate();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("pointerdown", pointerdown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}
