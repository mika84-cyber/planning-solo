import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ChoiceValue = string | number;

type MenuPlacement = {
  left: number;
  top: number;
  maxHeight: number;
  minWidth: number;
  width?: number;
};

export function ChoicePicker<T extends ChoiceValue>({
  value,
  options,
  onChange,
  ariaLabel,
  layout = "grid",
  className = "",
  placeholder,
  suffix,
  header,
  footer,
  panelLabel,
  portal = false,
}: {
  /** La chaîne vide vaut « rien de choisi » : le libellé d'attente prend
   *  alors la place, plutôt qu'une option que personne n'a retenue. */
  value: T | "";
  /** `className` habille une option non retenue (le mois d'aujourd'hui,
   *  cerclé) ; `current` la marque `aria-current="date"`. */
  options: Array<{ value: T; label: string; className?: string; current?: boolean }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  layout?: "grid" | "list";
  className?: string;
  /** Affiché quand la valeur courante ne correspond à aucune option : elle
   *  reste alors à choisir, sans figurer parmi les propositions. */
  placeholder?: string;
  /** Affiché dans le bouton après le libellé retenu, jamais dans la liste :
   *  l'année à côté du mois en tête du calendrier, par exemple. */
  suffix?: ReactNode;
  /** Un en-tête au-dessus des options ou un pied en dessous font de la liste
   *  un panneau (rôle dialog, nommé par `panelLabel`) ; les options y restent
   *  la liste nommée par `ariaLabel`. Le pied reçoit de quoi fermer le
   *  panneau ; l'en-tête, lui, le laisse ouvert. */
  header?: ReactNode;
  footer?: (close: () => void) => ReactNode;
  panelLabel?: string;
  /** Rend toujours la liste au niveau de la fenêtre, même à la souris : à
   *  poser quand le sélecteur vit dans une carte qui défile, sinon la liste
   *  y serait coupée. */
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [portalActive, setPortalActive] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value);

  const updatePlacement = useCallback(() => {
    if (!portalActive || !triggerRef.current || !menuRef.current) return;
    const viewportPadding = 10;
    const gap = 7;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current;
    const menuWidth = Math.min(menu.offsetWidth, window.innerWidth - viewportPadding * 2);
    const desiredHeight = menu.scrollHeight;
    const spaceBelow = window.innerHeight - trigger.bottom - gap - viewportPadding;
    const spaceAbove = trigger.top - gap - viewportPadding;
    const opensAbove = desiredHeight > spaceBelow && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, opensAbove ? spaceAbove : spaceBelow);
    const visibleHeight = Math.min(desiredHeight, availableHeight);
    const desiredLeft = trigger.left + trigger.width / 2 - menuWidth / 2;
    const left = Math.max(
      viewportPadding,
      Math.min(desiredLeft, window.innerWidth - viewportPadding - menuWidth),
    );
    const top = opensAbove
      ? Math.max(viewportPadding, trigger.top - gap - visibleHeight)
      : Math.min(
          trigger.bottom + gap,
          window.innerHeight - viewportPadding - visibleHeight,
        );
    setPlacement({
      left,
      top,
      maxHeight: availableHeight,
      minWidth: trigger.width,
      width: layout === "list" ? trigger.width : undefined,
    });
  }, [layout, portalActive]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !pickerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !portalActive) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    const frame = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, portalActive, updatePlacement]);

  /* En panneau, les options gardent leur liste (et sa grille) dans un
     conteneur, entre l'en-tête et le pied. */
  const panel = header !== undefined || footer !== undefined;
  /* Le rôle du menu et son nom vont de pair : le panneau est un dialogue
     nommé par `panelLabel`, la liste nue garde le nom des options. */
  const menuRole = panel
    ? { role: "dialog" as const, "aria-label": panelLabel }
    : { role: "listbox" as const, "aria-label": ariaLabel };
  const optionButtons = options.map((option) => (
    <button
      type="button"
      role="option"
      aria-selected={option.value === value}
      className={option.value === value ? "active" : option.className ?? ""}
      aria-current={option.current ? "date" : undefined}
      key={String(option.value)}
      onClick={() => {
        onChange(option.value);
        setOpen(false);
      }}
    >
      {option.label}
    </button>
  ));
  const menu = open ? (
    <div
      id={menuId}
      ref={menuRef}
      className={`choice-picker-menu${panel ? "" : ` ${layout}`}${portalActive ? ` choice-picker-menu-portal ${className}` : ""}`.trim()}
      {...menuRole}
      style={
        portalActive
          ? {
              position: "fixed",
              top: placement?.top ?? 0,
              right: "auto",
              left: placement?.left ?? 0,
              width: placement?.width,
              minWidth:
                placement?.minWidth ??
                triggerRef.current?.getBoundingClientRect().width ??
                0,
              maxHeight: placement?.maxHeight,
              visibility: placement ? "visible" : "hidden",
              transform: "none",
            }
          : undefined
      }
    >
      {panel ? (
        <>
          {header}
          <div className={`choice-picker-options ${layout}`} role="listbox" aria-label={ariaLabel}>{optionButtons}</div>
          {footer?.(() => setOpen(false))}
        </>
      ) : optionButtons}
    </div>
  ) : null;

  return (
    <div className={`choice-picker ${className}`.trim()} ref={pickerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`choice-picker-trigger${selected ? "" : " empty"}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup={panel ? "dialog" : "listbox"}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (!open) {
            setPortalActive(
              portal || window.matchMedia("(max-width: 720px), (pointer: coarse)").matches,
            );
          }
          setOpen((current) => !current);
        }}
      >
        <span>{selected?.label ?? placeholder ?? String(value)}</span>
        {suffix ? <>{" "}{suffix}</> : null}
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      {portalActive && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : menu}
    </div>
  );
}
