/**
 * The request identity of a comparison: the rows that it demands, the key of
 * each row, and the presentation that the rows settle into.
 */

import type { ComparisonMode as ToolbarMode } from "@mokly/ui/comparison-toolbar";

import type { ComparisonScope } from "./comparison_request.js";
import type { ComparedFramePlan } from "./comparison_selection.js";

/**
 * Available comparison presentations, exactly the modes the comparison toolbar
 * offers; Current never makes a request.
 */
export type ComparisonMode = ToolbarMode;

/** Axes and mode for the comparison artifact currently shown. */
export interface ComparisonPresentation {
  /** Scheme of the comparison artifact actually shown. */
  colorScheme: "dark" | "light";
  mode: Exclude<ComparisonMode, "current">;
  /** Sticky control selection retained for fallback labels. */
  requestedColorScheme: "dark" | "light";
  viewport: "both" | "desktop" | "mobile";
}

/** A shown frame whose row compares. */
export interface ComparisonFrameDemand extends ComparedFramePlan {
  /** The row's entry is a removed record, so its scope uses the index's `comparisonUrl`. */
  historical?: boolean;
}

/** One row that a comparison demands. */
export interface ComparisonRowDemand {
  /** The row's entry id, which names its generation. */
  id: string;
  /**
   * The row's scope, the mode and the row's shown axes. A loaded row whose
   * key changes renews its generation before its new panes load.
   */
  key: string;
  scope: ComparisonScope;
  /** A loaded generation renews only for the same scope. */
  scopeKey: string;
}

/** Every row that one comparison demands, in canvas order. */
export interface ComparisonDemand {
  /** Changes when a row's key or the presentation changes. */
  key: string;
  /** What the comparison shows once every row has settled for its key. */
  presentation: ComparisonPresentation;
  rows: readonly ComparisonRowDemand[];
}

/** What a comparison compares: the shown frames, or the routed entry alone. */
export interface ComparisonDemandInput {
  /** Side by side: the key of the compared frame among `frames`. */
  comparedFrame: string | undefined;
  /** The index's comparison root, which the scope of a removed row names. */
  comparisonUrl: string | null;
  /** The routed entry's id. */
  entryId: string;
  /** The shown frames whose rows compare; without them, the routed row alone. */
  frames: readonly ComparisonFrameDemand[] | undefined;
  /** Whether the routed entry is a removed record. */
  historical: boolean;
  presentation: ComparisonPresentation;
}

/**
 * The rows of one comparison. Overlay, Difference and Swipe demand each row of
 * the frames with the axes of its frames, and Side by side only the row of the
 * compared frame: the chosen frame, else the routed row's first frame, else
 * the first frame. Without frames, the routed entry's row alone is keyed on
 * the mode, the viewport, the effective scheme and the requested scheme.
 */
export function comparisonDemand({
  comparedFrame,
  comparisonUrl,
  entryId,
  frames,
  historical,
  presentation,
}: ComparisonDemandInput): ComparisonDemand {
  const { colorScheme, mode, requestedColorScheme, viewport } = presentation;
  const axes = [mode, viewport, colorScheme, requestedColorScheme];
  const rows = frames
    ? frameRows(
        shownFrames(frames, mode, comparedFrame, entryId),
        mode,
        comparisonUrl,
      )
    : [rowDemand(entryId, historical, comparisonUrl, axes)];
  return {
    key: JSON.stringify([axes, ...rows.map((row) => row.key)]),
    presentation,
    rows,
  };
}

/** The frames that a mode compares: Side by side compares one frame. */
function shownFrames(
  frames: readonly ComparisonFrameDemand[],
  mode: ComparisonPresentation["mode"],
  comparedFrame: string | undefined,
  entryId: string,
): readonly ComparisonFrameDemand[] {
  if (mode !== "side") return frames;
  const compared =
    frames.find((frame) => frame.key === comparedFrame) ??
    frames.find((frame) => frame.entry.path === entryId) ??
    frames[0];
  return compared ? [compared] : [];
}

/**
 * One demand for each row of the frames, in the frames' order, keyed on the
 * mode and the axes of the row's frames.
 */
function frameRows(
  frames: readonly ComparisonFrameDemand[],
  mode: ComparisonPresentation["mode"],
  comparisonUrl: string | null,
): ComparisonRowDemand[] {
  const rows = new Map<string, ComparisonFrameDemand[]>();
  for (const frame of frames) {
    const row = rows.get(frame.entry.path);
    if (row) row.push(frame);
    else rows.set(frame.entry.path, [frame]);
  }
  return [...rows].map(([id, own]) =>
    rowDemand(
      id,
      own.some((frame) => frame.historical === true),
      comparisonUrl,
      [mode, ...own.map((frame) => `${frame.viewport}:${frame.scheme}`)],
    ),
  );
}

/** One row's scope and the key of its shown axes. */
function rowDemand(
  id: string,
  historical: boolean,
  comparisonUrl: string | null,
  shown: readonly string[],
): ComparisonRowDemand {
  const scope: ComparisonScope = historical ? { id, comparisonUrl } : { id };
  const scopeKey = JSON.stringify(scope);
  return { id, key: JSON.stringify([scopeKey, ...shown]), scope, scopeKey };
}
