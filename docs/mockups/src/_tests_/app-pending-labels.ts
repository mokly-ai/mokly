/**
 * What an application source says about its waits: each `Pending` it renders,
 * the operation it names and whether that name is visible. The catalogue's
 * side is read from the drawn pages in `app-parity-reads.ts`.
 */

import type {
  PendingLabelMode,
  PendingLabelRendering,
} from "./app-parity-reads";
import { bracedValue, elementProps } from "./app-state-titles";

/**
 * Literal pending labels rendered by one application owner source. Each
 * `Pending` is read from its own opening tag, whether it closes itself or
 * wraps the layout it waits for, so nothing inside that layout is read as one
 * of its props. A label chosen in place, `label={installing ? "…" : "…"}`,
 * counts each literal it can show. A label the source only passes on, and a
 * mode it does not write as a literal, are left to the file that decides them.
 */
export function sourcePendingLabels(text: string): PendingLabelRendering[] {
  const found: PendingLabelRendering[] = [];
  for (const opening of text.matchAll(/<Pending\b/g)) {
    const props = elementProps(text, opening.index + opening[0].length);
    const mode = sourcePendingMode(props);
    if (mode === undefined) continue;
    for (const label of sourcePendingLabelsOf(props))
      found.push({ label, mode });
  }
  return found;
}

/** The mode one `Pending`'s props write, or nothing where an expression does. */
function sourcePendingMode(props: string): PendingLabelMode | undefined {
  if (/\blabelMode=\{/.test(props)) return undefined;
  return /\blabelMode="screen-reader-only"/.test(props)
    ? "screen-reader-only"
    : "visible";
}

/**
 * The literal labels one `Pending`'s props can show. A literal the expression
 * compares against chooses the label; it is not one.
 */
function sourcePendingLabelsOf(props: string): string[] {
  const literal = /\blabel="([^"]+)"/.exec(props);
  if (literal) return [literal[1]];
  const braced = bracedValue(props, "label");
  if (braced === undefined) return [];
  return [...braced.matchAll(/"([^"]+)"/g)]
    .filter((inside) => !/(?:[=!]==?)\s*$/.test(braced.slice(0, inside.index)))
    .map((inside) => inside[1]);
}
