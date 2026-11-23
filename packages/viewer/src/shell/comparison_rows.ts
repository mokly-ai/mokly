/**
 * The frames that a compare can draw, and the comparison facts of each row
 * that they show. A screen's and a variant set's frames are the shown frames
 * of the canvas, which the Frames filter and the compact layout choose. A
 * removed component or variant has no live frames, so its compare draws the
 * frames of its own views: each view of its desktop viewport, Light then
 * Dark, as a variant set's row draws them.
 */

import type { ComparedEntry } from "../review/types.js";

import type { CanvasFramePlan } from "./canvas_frames.js";
import { viewportFrameLabel } from "./canvas_frames.js";
import type { ComparedFramePlan, ComparedRow } from "./comparison_selection.js";
import { publicComparedEntry } from "./public_compared.js";
import type { WorkspaceData } from "./workspace_data.js";

/** A frame that a compare can draw, with its place and its names. */
export interface ComparisonFramePlan extends ComparedFramePlan {
  column: number;
  kind: CanvasFramePlan["kind"];
  /** The frame's label as the canvas shows it, such as `welcome · Mobile · Light`. */
  label: string;
  /** The frame's own name, such as `Mobile · Light` or `Default · Light`. */
  name: string;
  row: number;
}

const SCHEMES = { dark: "Dark", light: "Light" } as const;

/**
 * The shown frames of the canvas as frames that a compare can draw, in their
 * order. A screen frame's own name is its viewport and scheme, which the
 * compact layout leads with the entry's slug in its label.
 */
export function comparisonFramePlans(
  frames: readonly CanvasFramePlan[],
): ComparisonFramePlan[] {
  return frames
    .filter((frame) => !frame.hidden)
    .map((frame) => ({
      column: frame.column,
      entry: { path: frame.entry.path },
      key: frame.key,
      kind: frame.kind,
      label: frame.label,
      name:
        frame.kind === "component"
          ? frame.label
          : viewportFrameLabel(frame.viewport, frame.scheme),
      row: frame.row,
      scheme: frame.scheme,
      viewport: frame.viewport,
    }));
}

/**
 * The frames of a removed component or variant, which has no live frames:
 * one for each desktop view of its comparison, Light then Dark, named by the
 * entry's title and the view's scheme.
 */
export function removedComparisonPlans(
  compared: ComparedEntry | undefined,
  entry: { path: string; title: string },
): ComparisonFramePlan[] {
  if (!compared) return [];
  return (["light", "dark"] as const).flatMap((scheme, column) =>
    compared.views.some(
      (view) => view.viewport === "desktop" && view.colorScheme === scheme,
    )
      ? [
          {
            column,
            entry: { path: entry.path },
            key: `${entry.path}:${scheme}`,
            kind: "component" as const,
            label: `${entry.title} · ${SCHEMES[scheme]}`,
            name: `${entry.title} · ${SCHEMES[scheme]}`,
            row: 0,
            scheme,
            viewport: "desktop" as const,
          },
        ]
      : [],
  );
}

/**
 * The comparison facts of each row by its entry id: the routed entry's from
 * its detail, and another row of a variant set's from its index record.
 */
export function comparedRows(
  data: Pick<WorkspaceData, "compared" | "variants">,
  routed: string,
  usingChanged: ReadonlySet<string> = new Set(),
): (entry: string) => ComparedRow | undefined {
  return (entry) => {
    if (entry === routed)
      return data.compared
        ? { compared: data.compared, usingChanged }
        : undefined;
    const row = data.variants.find((variant) => variant.value.path === entry);
    const compared = row
      ? publicComparedEntry(row.value, undefined)
      : undefined;
    return compared ? { compared, usingChanged: new Set() } : undefined;
  };
}
