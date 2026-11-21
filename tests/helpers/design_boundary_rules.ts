import { canvasPalette, designPalette } from "./design_palette.js";
import {
  boundaryOf,
  designStyleRules,
  fillOf,
  type ColorReference,
  type StyleRule,
} from "./design_styles.js";

/**
 * Selectors that mark a control state. A boundary drawn only in one of these
 * states is the state's own indicator, so it carries the 3:1 requirement.
 */
const STATE_SELECTOR =
  /:hover|:focus|:checked|:has\(input:checked\)|:disabled|\[open\]|\.active|aria-pressed|aria-current/u;

/**
 * Fills that mark a selected, active or status surface, derived from the
 * palettes so a new accent, signal or status role joins the audit without an
 * edit here.
 */
function markedFillTokens(tokens: Map<string, string>): string[] {
  return [...tokens.keys()].filter(
    (token) =>
      token.startsWith("--mbk-accent-") ||
      token.startsWith("--cv-signal") ||
      token === "--mbk-danger-bg" ||
      token === "--chrome-disabled-bg" ||
      (token.startsWith("--mbk-status-") && token.endsWith("-bg")),
  );
}

/** A rule that draws a marked boundary, with the boundary and its fill. */
export interface MarkedBoundaryRule extends StyleRule {
  boundary: ColorReference;
  fill: ColorReference | undefined;
}

/**
 * Rules whose boundary is a control or state indicator: either the selector
 * names a state, or the rule fills itself with a marked surface of the
 * design palette or of the Canvas palette.
 */
export async function markedBoundaryRules(): Promise<MarkedBoundaryRule[]> {
  const marked = new Set(
    [await designPalette(), await canvasPalette()].flatMap((palette) =>
      markedFillTokens(palette.light).flatMap((token) => [
        token,
        palette.light.get(token)?.toLowerCase() ?? token,
        palette.dark.get(token)?.toLowerCase() ?? token,
      ]),
    ),
  );
  return (await designStyleRules()).flatMap((rule) => {
    const boundary = boundaryOf(rule.body);
    if (!boundary) return [];
    const fill = fillOf(rule.body);
    const fillMark = fill?.token ?? fill?.literal?.toLowerCase();
    if (
      !STATE_SELECTOR.test(rule.selector) &&
      !(fillMark && marked.has(fillMark))
    )
      return [];
    return [{ ...rule, boundary, fill }];
  });
}
