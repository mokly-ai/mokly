import { documentPalettes, paletteColors } from "./palettes";
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
  const { roles, scope } = documentPalettes.paper;
  const selector =
    root === undefined
      ? "." + scope
      : root + "." + scope + "," + root + " ." + scope;
  return (
    selector + "{" + cssVariables({ color: paletteColors(scheme, roles) }) + "}"
  );
}

/** Viewport and theme values belong to the document, not duplicated screen trees. */
export function tokenCss(
  scheme: TokenColorScheme,
  viewport: TokenViewport,
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
    scopeCss(scheme)
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
