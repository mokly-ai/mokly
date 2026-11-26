import { transformStyleAttribute } from "lightningcss";
import postcss, { CssSyntaxError } from "postcss";
import type { Declaration, Node, Root } from "postcss";
import valueParser from "postcss-value-parser";

import type { Scheme } from "./catalogue-paths";

const colorMarker = "\u0000color\u0000";
const literalColors = new Map<string, boolean>();
const colorFunctions =
  /^(?:rgba?|hsla?|color-mix|color|oklch|oklab|lch|lab|hwb)$/i;
const gradient = /^(?:repeating-)?(?:radial|linear|conic)-gradient$/i;

export function normalizeColor(value: string): string {
  let isColor = literalColors.get(value);
  if (isColor === undefined) {
    isColor = false;
    if (!/[;{}!]/.test(value)) {
      try {
        transformStyleAttribute({
          code: Buffer.from("color:" + value),
          visitor: {
            Declaration(declaration) {
              isColor = declaration.property === "color";
            },
          },
        });
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    literalColors.set(value, isColor);
  }
  return isColor ? colorMarker : value;
}

function normalizePaint(value: string): string {
  return valueParser.stringify(valueParser(value).nodes, (node) => {
    if (node.type === "word" && /^(?:#[\da-f]+|[a-z]+)$/i.test(node.value))
      return normalizeColor(node.value);
    if (node.type !== "function" || gradient.test(node.value)) return;
    const call = valueParser.stringify(node);
    return colorFunctions.test(node.value) && !node.unclosed
      ? normalizeColor(call)
      : call;
  });
}

const colorProperty = /^(?:color|[a-z-]+-color|fill|stroke)$/;
const paintProperty = /^(?:background(?:-image)?|box-shadow|text-shadow)$/;
const paintShorthand =
  /^(?:outline|border(?:-(?:top|right|bottom|left))?|text-decoration)$/;
const tokenPaint = /^(?:--mk-color-|--mk-shadow-|--placeholderTextColor$)/;
const viewerPaint = /^--(?:cv-|chrome-|_mokly-private-|mbk-)/;
const sharedPaintNames =
  "--(?:fo-canvas-(?:shade|scrim|shadow-(?:float|deep))|chrome-shadow(?:-[a-z]+)?|mb-shadow)";
const sharedPaint = new RegExp(`^${sharedPaintNames}$`);
const sharedPaintReference = new RegExp(`var\\(\\s*${sharedPaintNames}\\b`);
export const schemeAttribute = /^(?:data-color-scheme|data-scheme)$/;
export const svgPaintAttribute =
  /^(?:fill|stroke|stop-color|flood-color|lighting-color)$/;
const changingAttribute =
  /\[\s*(?:[\w*-]*\|)?(?:data-color-scheme|data-scheme|style|(?:data-nav-)?href|fill|stroke|stop-color|flood-color|lighting-color)\s*[*^$~|]?=/i;
const readsChangingAttribute =
  /attr\(\s*(?:data-color-scheme|data-scheme|style|(?:data-nav-)?href|fill|stroke|stop-color|flood-color|lighting-color)\b/i;

function parseCss(css: string): Root | undefined {
  try {
    return postcss.parse(css);
  } catch (error) {
    if (!(error instanceof CssSyntaxError)) throw error;
  }
}

function schemeChangesOnlyPaint(
  { prop, value }: Declaration,
  unconditionalProperties: ReadonlySet<string>,
): boolean {
  if (prop.startsWith("--") && !unconditionalProperties.has(prop)) return false;
  if (prop === "color-scheme") return value === "dark" || value === "light";
  if (sharedPaint.test(prop)) return !/(?:url|src|image-set)\(|\\/i.test(value);
  return (
    (viewerPaint.test(prop) ||
      tokenPaint.test(prop) ||
      colorProperty.test(prop)) &&
    normalizeColor(value) === colorMarker
  );
}

function mayChangeLayout(sheet: Root): boolean {
  const themeConditions = new Set<Node>();
  const hasUnverifiedAtRules =
    sheet.walkAtRules((rule) => {
      if (
        rule.name.toLowerCase() === "import" ||
        /style\((?!\s*--fo-window-inset(?:-end)?\s*:)/i.test(rule.params)
      )
        return false;
      if (/prefers-color-scheme/i.test(rule.params)) themeConditions.add(rule);
    }) === false;
  if (hasUnverifiedAtRules) return true;

  const hasUnverifiedSelectors =
    sheet.walkRules((rule) => {
      if (rule.selector.includes("\\")) return false;
      if (
        changingAttribute.test(rule.selector.replace(/\/\*[\s\S]*?\*\//g, ""))
      )
        themeConditions.add(rule);
    }) === false;
  if (hasUnverifiedSelectors) return true;

  const unconditionalProperties = new Set<string>();
  const themeDeclarations: Declaration[] = [];
  const hasUnverifiedDeclarations =
    sheet.walkDecls((declaration) => {
      const { prop, value } = declaration;
      if (readsChangingAttribute.test(value) || /\bif\(/i.test(value))
        return false;
      if (
        sharedPaintReference.test(value) &&
        !sharedPaint.test(prop) &&
        !paintProperty.test(prop) &&
        !colorProperty.test(prop)
      )
        return false;
      if (themeConditions.size === 0) return;
      let parent: Node | undefined = declaration.parent;
      while (parent && !themeConditions.has(parent)) parent = parent.parent;
      if (parent) themeDeclarations.push(declaration);
      else if (prop.startsWith("--")) unconditionalProperties.add(prop);
    }) === false;
  return (
    hasUnverifiedDeclarations ||
    themeDeclarations.some(
      (declaration) =>
        !schemeChangesOnlyPaint(declaration, unconditionalProperties),
    )
  );
}

export function linkedCssCanShareSweep(css: string): boolean {
  const sheet = parseCss(css);
  return sheet !== undefined && !mayChangeLayout(sheet);
}

/** Keep the CSS structure and only replace paint values and the scheme marker. */
export function normalizeInlineCss(
  css: string,
  scheme: Scheme,
): string | undefined {
  const sheet = parseCss(css);
  if (sheet === undefined || mayChangeLayout(sheet)) return;
  sheet.walkDecls((declaration) => {
    const { prop, value } = declaration;
    const raw = declaration.raws.value?.raw ?? value;
    let normalized = raw;
    if (prop === "color-scheme" && raw === scheme)
      normalized = "\u0000scheme\u0000";
    else if (
      colorProperty.test(prop) ||
      paintProperty.test(prop) ||
      paintShorthand.test(prop) ||
      tokenPaint.test(prop)
    )
      normalized = normalizePaint(raw);
    if (normalized !== raw) {
      declaration.value = normalized;
      delete declaration.raws.value;
    }
  });
  return sheet.toString();
}
