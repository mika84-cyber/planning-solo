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
      if (!activeDialog) {
        previousFocus = document.activeElement as HTMLElement | null;
        previousOverflow = document.body.style.overflow;
      }
      activeDialog = next;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        const preferred = activeDialog?.querySelector<HTMLElement>(
          "[autofocus], input:not([disabled]), button:not([disabled])",
        );
        (preferred || activeDialog)?.focus();
      });
    };

    const keydown = (event: KeyboardEvent) => {
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
    activate();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}
