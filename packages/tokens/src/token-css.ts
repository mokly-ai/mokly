import {
  canvasColors,
  documentPalettes,
  paletteColors,
  paletteFonts,
} from "./palettes";
import type { DocumentPalette, PaletteRoles } from "./palettes";
import { tokens } from "./tokens";
import type { TokenColorScheme, TokenViewport } from "./tokens";

type TokenTree = { readonly [key: string]: string | number | TokenTree };

/** Flatten semantic tokens into the single source of CSS custom properties. */
export function cssVariables(tree: TokenTree, prefix = "--mk"): string {
  return Object.entries(tree)
    .map(([key, value]) => {
      const name =
        prefix +
        "-" +
        key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
      return typeof value === "object"
        ? cssVariables(value, name)
        : name + ":" + value + ";";
    })
    .join("");
}

const scopes: readonly [PaletteRoles, string][] = [
  ["paper", "paper-scope"],
  ["folio", "folio-scope"],
];

function typeVariables(viewport: TokenViewport): string {
  return cssVariables({
    type: Object.fromEntries(
      Object.entries(tokens.type).map(([name, value]) => [
        name,
        {
          size: value[viewport][0],
          line: value[viewport][1],
          weight: value.weight,
        },
      ]),
    ),
  });
}

function scopeCss(scheme: TokenColorScheme, root?: string): string {
  return scopes
    .map(
      ([palette, scope]) =>
        (root === undefined
          ? "." + scope
          : root + "." + scope + "," + root + " ." + scope) +
        "{" +
        cssVariables({ color: paletteColors(scheme, palette) }) +
        "}",
    )
    .join("");
}

/**
 * The scope rule of a canvas document: the Canvas surfaces, its accent and
 * its own roles, and its font stacks. Only a canvas document carries it, so
 * the token CSS of every other document stays the same.
 */
function canvasScopeCss(scheme: TokenColorScheme): string {
  return (
    "." +
    documentPalettes.canvas.scope +
    "{" +
    cssVariables({
      color: { ...paletteColors(scheme, "canvas"), ...canvasColors(scheme) },
      font: paletteFonts("canvas"),
    }) +
    "}"
  );
}

/**
 * Viewport and theme values belong to the document, not duplicated screen
 * trees. A document of the canvas palette also carries the canvas scope.
 */
export function tokenCss(
  scheme: TokenColorScheme,
  viewport: TokenViewport,
  palette: DocumentPalette = "default",
): string {
  return (
    ":root{" +
    cssVariables({
      color: tokens.color[scheme],
      shadow: tokens.shadow[scheme],
      font: tokens.font,
    }) +
    typeVariables(viewport) +
    cssVariables({
      space: tokens.space,
      radius: tokens.radius,
      layout: tokens.layout,
      motion: tokens.motion,
    }) +
    "color-scheme:" +
    scheme +
    ";}" +
    scopeCss(scheme) +
    (palette === "canvas" ? canvasScopeCss(scheme) : "")
  );
}

/**
 * The running application resizes with its window rather than rendering one
 * generated viewport, so the type ramp switches at the shared breakpoint
 * instead of being baked into the document.
 */
export function responsiveTokenCss(
  scheme: TokenColorScheme,
  selector?: string,
): string {
  if (selector !== undefined) {
    return (
      selector +
      "{" +
      cssVariables({
        color: tokens.color[scheme],
        shadow: tokens.shadow[scheme],
        font: tokens.font,
      }) +
      typeVariables("desktop") +
      cssVariables({
        space: tokens.space,
        radius: tokens.radius,
        layout: tokens.layout,
        motion: tokens.motion,
      }) +
      "color-scheme:" +
      scheme +
      ";}" +
      scopeCss(scheme, selector) +
      "@media (max-width:" +
      (parseFloat(tokens.layout.breakpoint) - 0.02) +
      "px){" +
      selector +
      "{" +
      typeVariables("mobile") +
      "}}"
    );
  }
  return (
    tokenCss(scheme, "desktop") +
    "@media (max-width:" +
    (parseFloat(tokens.layout.breakpoint) - 0.02) +
    "px){:root{" +
    typeVariables("mobile") +
    "}}"
  );
}
