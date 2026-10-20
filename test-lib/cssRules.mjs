// Lecture structurée des feuilles de style pour les tests : les contrôles
// portent sur des sélecteurs et des déclarations, pas sur le texte exact des
// fichiers. Déplacer une règle d'une feuille à l'autre, la reformater ou la
// réunir avec une autre ne casse donc plus un test, tant que le rendu décrit
// reste le même.
import { readFileSync } from "node:fs";
import postcss from "postcss";

/** Un sélecteur sans espaces superflus : `.a  >  .b` et `.a>.b` se valent. */
export function normalizeSelector(selector) {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,])\s*/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

/** Une condition de media normalisée : `(max-width:720px)`. */
export function normalizeMedia(params) {
  return params.replace(/\s+/g, "").toLowerCase();
}

/** Une valeur sans espaces superflus : `repeat(2,minmax(0,1fr))` et
 *  `repeat(2, minmax(0, 1fr))` se valent. */
export function normalizeValue(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ", ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function declarationsOf(rule) {
  const declarations = {};
  for (const node of rule.nodes) {
    if (node.type !== "decl") continue;
    const value = normalizeValue(node.value);
    declarations[node.prop] = node.important ? `${value} !important` : value;
  }
  return declarations;
}

/** Charge et indexe les feuilles données (chemins absolus ou URL de fichier). */
export function loadStylesheets(paths) {
  const rules = [];
  const keyframes = new Set();
  for (const path of paths) {
    const root = postcss.parse(readFileSync(path, "utf8"));
    root.walkAtRules((atRule) => {
      if (/keyframes$/.test(atRule.name)) keyframes.add(atRule.params.trim());
    });
    root.walkRules((rule) => {
      if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
      const media = [];
      for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent)
        if (parent.type === "atrule" && parent.name === "media") media.unshift(normalizeMedia(parent.params));
      rules.push({
        file: String(path),
        media: media.join(" and "),
        selector: normalizeSelector(rule.selector),
        selectors: rule.selectors.map(normalizeSelector),
        declarations: declarationsOf(rule),
      });
    });
  }
  return new Stylesheets(rules, keyframes);
}

export class Stylesheets {
  constructor(rules, keyframes) {
    this.rules = rules;
    this.keyframes = keyframes;
  }

  /** Les règles dont la liste de sélecteurs contient exactement celui-ci,
   *  sous la media donnée (toutes si elle est omise). */
  rulesFor(selector, media) {
    const wanted = normalizeSelector(selector);
    const wantedMedia = media === undefined ? undefined : normalizeMedia(media);
    return this.rules.filter(
      (rule) => rule.selectors.includes(wanted) && (wantedMedia === undefined || rule.media === wantedMedia),
    );
  }

  /** Vrai si un sélecteur exact existe (sous la media donnée s'il y en a une). */
  hasRule(selector, media) {
    return this.rulesFor(selector, media).length > 0;
  }

  /** Vrai si le texte apparaît dans un sélecteur, quelle que soit la règle. */
  mentions(text) {
    const wanted = normalizeSelector(text);
    return this.rules.some((rule) => rule.selector.includes(wanted));
  }

  /** Les déclarations cumulées des règles d'un sélecteur exact, dans l'ordre
   *  de la cascade : la dernière valeur d'une propriété l'emporte. */
  declarations(selector, media) {
    const merged = {};
    for (const rule of this.rulesFor(selector, media)) Object.assign(merged, rule.declarations);
    return merged;
  }

  /** Vrai si une règle, n'importe laquelle, déclare cette propriété avec cette valeur. */
  declares(property, value, { within } = {}) {
    const wanted = within === undefined ? undefined : normalizeSelector(within);
    const wantedValue = normalizeValue(value);
    return this.rules.some(
      (rule) => (wanted === undefined || rule.selector.includes(wanted)) && rule.declarations[property] === wantedValue,
    );
  }

  /** Vrai si une valeur, n'importe où, contient ce texte (une couleur, une adresse…). */
  usesValue(text) {
    const wanted = normalizeValue(text);
    return this.rules.some((rule) => Object.values(rule.declarations).some((value) => value.includes(wanted)));
  }

  /** Vrai si une règle porte exactement ce sélecteur et toutes ces déclarations. */
  anyRuleDeclares(selector, declarations) {
    return this.rulesFor(selector).some((rule) =>
      Object.entries(declarations).every(([property, value]) => rule.declarations[property] === normalizeValue(value)),
    );
  }

  /** Vrai si une règle, n'importe laquelle, porte toutes ces déclarations. */
  declaresTogether(declarations) {
    return this.rules.some((rule) =>
      Object.entries(declarations).every(([property, value]) => rule.declarations[property] === normalizeValue(value)),
    );
  }

  /** Vrai si une même règle réunit tous ces sélecteurs. */
  hasRuleWithSelectors(selectors) {
    const wanted = selectors.map(normalizeSelector);
    return this.rules.some((rule) => wanted.every((selector) => rule.selectors.includes(selector)));
  }

  /** Vrai si une propriété (une variable, par exemple) est déclarée quelque part. */
  declaresProperty(property) {
    return this.rules.some((rule) => rule.declarations[property] !== undefined);
  }

  /** Vrai si une condition @media existe telle quelle. */
  hasMedia(params) {
    const wanted = normalizeMedia(params);
    return this.rules.some((rule) => rule.media === wanted);
  }

  /** Vrai si une animation nommée est définie par @keyframes. */
  hasKeyframes(name) {
    return this.keyframes.has(name);
  }

  /** Vrai si le texte apparaît quelque part : sélecteur, valeur ou animation. */
  anywhere(text) {
    return this.mentions(text) || this.usesValue(text) || this.keyframes.has(text);
  }
}
