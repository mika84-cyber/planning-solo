/**
 * Mode sombre de toute l'application, chargé seulement quand il est actif.
 *
 * Plutôt que de réécrire des milliers de règles, le thème sombre est dérivé
 * des feuilles de style chargées : chaque déclaration de couleur est recopiée
 * avec le même sélecteur, dans le même ordre, avec sa couleur adaptée. Les
 * fonds clairs deviennent sombres, les textes sombres deviennent clairs, les
 * filets s'adaptent ; les couleurs franches (terracotta, couleurs des congés,
 * boutons) restent telles quelles. Les feuilles chargées plus tard — celles
 * des rubriques ouvertes à la demande — sont reprises à leur arrivée. Les
 * retouches écrites à la main vivent dans darkTheme.css.
 */

type Rgba = [number, number, number, number];
type ColorRole = "background" | "text" | "border" | "shadow";

export const DARK_STYLE_ID = "planning-dark-theme";

function parseColor(token: string): Rgba | null {
  const value = token.toLowerCase();
  if (value === "white") return [255, 255, 255, 1];
  if (value === "black") return [0, 0, 0, 1];
  if (value[0] === "#") {
    const hex = value.length <= 5 ? [...value.slice(1)].map((digit) => digit + digit).join("") : value.slice(1);
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return null;
    const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16);
    return [channel(0), channel(2), channel(4), hex.length === 8 ? channel(6) / 255 : 1];
  }
  const numbers = value.match(/[\d.]+%?/g);
  if (!numbers || numbers.length < 3) return null;
  const alpha = numbers[3] === undefined ? 1 : Number.parseFloat(numbers[3]) / (numbers[3].endsWith("%") ? 100 : 1);
  return [Number(numbers[0]), Number(numbers[1]), Number(numbers[2]), alpha];
}

/** Déplace la luminosité d'une couleur de `from` vers `to` en gardant sa
 *  teinte : on l'éloigne du noir, ou du blanc, dans la même proportion. */
function relight([r, g, b, a]: Rgba, from: number, to: number): Rgba {
  const scale = (channel: number) => to <= from
    ? channel * (to / Math.max(from, 0.001))
    : 255 - (255 - channel) * ((1 - to) / Math.max(1 - from, 0.001));
  // Une pointe de chaleur, pour rester dans les bruns de l'application.
  return [Math.min(255, Math.round(scale(r)) + 3), Math.round(scale(g)) + 1, Math.max(0, Math.round(scale(b)) - 1), a];
}

/** Adapte une couleur selon son rôle ; renvoie null quand elle reste telle quelle. */
export function darkenColor(color: Rgba, role: ColorRole): Rgba | null {
  const lightness = (Math.max(color[0], color[1], color[2]) + Math.min(color[0], color[1], color[2])) / 510;
  if (role === "background" || role === "shadow") {
    return lightness >= 0.72 ? relight(color, lightness, 0.11 + (1 - lightness) * 0.55) : null;
  }
  if (role === "text") return lightness <= 0.5 ? relight(color, lightness, 0.92 - lightness * 0.55) : null;
  if (lightness >= 0.55) return relight(color, lightness, 0.21 + (1 - lightness) * 0.45);
  return lightness <= 0.45 ? relight(color, lightness, 0.5 + (0.45 - lightness) * 0.25) : null;
}

export function darkenColorsIn(value: string, role: ColorRole) {
  return value.replace(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g, (token) => {
    const parsed = parseColor(token);
    const next = parsed && darkenColor(parsed, role);
    if (!next) return token;
    return next[3] >= 1 ? `rgb(${next[0]}, ${next[1]}, ${next[2]})` : `rgba(${next[0]}, ${next[1]}, ${next[2]}, ${Math.round(next[3] * 1000) / 1000})`;
  });
}

/** Rôle d'une propriété de couleur, ou null si elle n'en porte pas. */
export function colorRole(property: string): ColorRole | null {
  if (property.startsWith("--")) {
    if (/border|line|outline|frame/.test(property)) return "border";
    if (/^--(text|muted)$|ink|-text$|copy$|secondary-muted/.test(property)) return "text";
    return /^--(bg|card|work)$|surface|background|tint$|soft$|-bg$/.test(property) && !/shadow/.test(property) ? "background" : null;
  }
  if (/^background(-color|-image)?$/.test(property)) return "background";
  if (property === "box-shadow") return "shadow";
  if (/^(color|fill|stroke|caret-color|text-decoration-color|column-rule-color)$/.test(property)) return "text";
  return /^(border|outline)(-(top|right|bottom|left))?-color$/.test(property) ? "border" : null;
}

/** « 1px solid var(--line) » → « var(--line) » : la seule couleur d'un raccourci de filet. */
export function borderColorPart(shorthand: string) {
  const parts = shorthand.trim().split(/\s+(?![^(]*\))/);
  return parts.filter((part) => !/^(?:0|[\d.]+(?:px|em|rem|%)|thin|medium|thick|none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/.test(part)).join(" ");
}

/** Le terracotta foncé, lisible sur fond clair, devient un terracotta clair
 *  quand il colore un texte sur fond sombre ; les fonds de boutons le gardent. */
export function adaptAccentText(value: string, role: ColorRole) {
  return role === "text" ? value.replace(/var\(--accent(?:-strong)?\)/g, "#e2a383") : value;
}

function translateRule(style: CSSStyleDeclaration) {
  const declarations: string[] = [];
  let backgroundCopied = false;
  for (const property of Array.from(style)) {
    const role = colorRole(property);
    if (!role) continue;
    let name = property;
    let value = style.getPropertyValue(property);
    // Une longhand issue d'un raccourci qui contient var() se lit vide. Pour
    // un fond, on recopie le raccourci entier ; pour un filet, on n'en garde
    // que la couleur — recopier « 1px solid … » ferait réapparaître un cadre
    // qu'une règle plus précise avait retiré.
    if (!value.trim()) {
      if (role === "background") {
        if (backgroundCopied || !style.getPropertyValue("background").trim()) continue;
        backgroundCopied = true;
        name = "background";
        value = style.getPropertyValue("background");
      } else if (role === "border") {
        const side = property.split("-")[1];
        value = borderColorPart([`border-${side}`, "border-color", "border", "outline"].map((candidate) => style.getPropertyValue(candidate)).find((found) => found.trim()) || "");
      }
      if (!value.trim()) continue;
    }
    const priority = style.getPropertyPriority(property) ? " !important" : "";
    declarations.push(`${name}:${adaptAccentText(darkenColorsIn(value, role), role)}${priority}`);
  }
  return declarations.join(";");
}

/** Les couleurs qui disent quelque chose — type de congé, statut d'un jour,
 *  case de la vue semaine — gardent leur teinte d'origine : les assombrir les
 *  rendrait ternes et indistinctes. Le fond de ces cases est repris à la main
 *  dans darkTheme.css. */
const KEEP_COLORS = /\.(day|mini-day|leave-band|note-band|leave-calendar-marker|recovery-calendar-label|exchange-calendar-label|work-accident-calendar-marker|exceptional-closure-marker|holiday-date|agnes-leave-date|school-vacation-day|colleague-week-cell|colleague-tomorrow-status)(?![\w-])/;

function translateRules(rules: CSSRuleList): string {
  let output = "";
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      // Les retouches de darkTheme.css sont déjà sombres : on ne les convertit pas.
      if (rule.selectorText.includes("data-theme") || KEEP_COLORS.test(rule.selectorText)) continue;
      const body = translateRule(rule.style);
      if (body) output += `${rule.selectorText}{${body}}`;
    } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
      const nested = translateRules(rule.cssRules);
      if (nested) output += `${rule.cssText.slice(0, rule.cssText.indexOf("{"))}{${nested}}`;
    }
  }
  return output;
}

let enabled = false;
let scheduled = 0;
let observer: MutationObserver | null = null;

function rebuild() {
  scheduled = 0;
  const element = (document.getElementById(DARK_STYLE_ID) as HTMLStyleElement | null) || document.createElement("style");
  element.id = DARK_STYLE_ID;
  if (!enabled) return element.remove();
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.ownerNode === element) continue;
    try {
      css += translateRules(sheet.cssRules);
    } catch {
      // Feuille encore en chargement : elle sera reprise à son arrivée.
    }
  }
  element.textContent = css;
  // Toujours en dernier : les règles sombres gagnent à sélecteur égal.
  document.head.appendChild(element);
}

export function syncDarkStyles(dark: boolean) {
  enabled = dark;
  if (!observer) {
    observer = new MutationObserver((mutations) => {
      for (const node of mutations.flatMap((mutation) => Array.from(mutation.addedNodes))) {
        if (!(node instanceof HTMLStyleElement || node instanceof HTMLLinkElement) || node.id === DARK_STYLE_ID) continue;
        const schedule = () => { if (enabled && !scheduled) scheduled = requestAnimationFrame(rebuild); };
        node.addEventListener("load", schedule, { once: true });
        schedule();
      }
    });
    observer.observe(document.head, { childList: true });
  }
  rebuild();
}
