// Computes the indentation and faint vertical guide lines for one Mokly
// navigation row. Every row is padded left by its depth and paints a 1px guide
// line for each ancestor level, so the guides run continuously down a subtree
// and make it easy to see which rows sit at the same depth — folders and files
// alike. The row also exposes its indent as the `--mbk-indent` custom property
// so the shell stylesheet can inset the hover / selected highlight to the
// content, leaving the guide lines to its left uncovered. The guides use the
// faint `--mbk-guide` colour defined in the shell stylesheet.

import type { CSSProperties } from "react";

/** Left padding applied to a top-level (depth 0) row, in pixels. */
const ROOT_INSET = 8;
/** Horizontal distance between nesting levels, in pixels. */
const INDENT_STEP = 16;
/** X offset of a level's guide line, aligned under that level's folder icon. */
const GUIDE_OFFSET = 15;

/**
 * The inline style for a navigation row at `depth`: its indentation, the
 * `--mbk-indent` offset used to inset the selection highlight, and one faint
 * vertical guide line per ancestor level (a root row gets none).
 */
export function navRowStyle(depth: number): CSSProperties {
  const level = Math.max(depth, 0);
  const style: Record<string, string | number> = {
    paddingLeft: ROOT_INSET + level * INDENT_STEP,
    "--mbk-indent": `${level * INDENT_STEP}px`,
  };
  if (level === 0) {
    return style as CSSProperties;
  }
  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];
  for (let ancestor = 0; ancestor < level; ancestor += 1) {
    images.push("linear-gradient(var(--mbk-guide), var(--mbk-guide))");
    positions.push(`${GUIDE_OFFSET + ancestor * INDENT_STEP}px 0`);
    sizes.push("1px 100%");
  }
  style["backgroundImage"] = images.join(", ");
  style["backgroundPosition"] = positions.join(", ");
  style["backgroundSize"] = sizes.join(", ");
  style["backgroundRepeat"] = "no-repeat";
  return style as CSSProperties;
}
