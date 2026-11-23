/**
 * The compact layout's frames: one frame at a time on the canvas, and the
 * frame picker of the entry bar, which lists the shown frames of the canvas
 * frames model. A screen shows the frame that the selection's viewport and
 * scheme name, where `both` reads as Mobile. A variant set shows its whole
 * set until a selection picks a frame: the routed saved variant's frame in
 * the selection's scheme.
 */

import type { EntryBarFrame } from "@mokly/ui/entry-bar";

import type { ViewerSelection } from "../host/types.js";

import type { CanvasFramePlan, CanvasScheme } from "./canvas_frames.js";

/** A screen's frames in the picker: Mobile before Desktop, Light before Dark. */
const VIEWPORT_ORDER = ["mobile", "desktop"] as const;
const SCHEME_ORDER = ["light", "dark"] as const;

function screenFrame(frame: CanvasFramePlan): boolean {
  return frame.kind === "desktop" || frame.kind === "mobile";
}

function screenRank(frame: CanvasFramePlan): number {
  return (
    VIEWPORT_ORDER.indexOf(frame.viewport) * SCHEME_ORDER.length +
    SCHEME_ORDER.indexOf(frame.scheme)
  );
}

/**
 * The frames that the picker lists: the shown frames, each by its name. A
 * screen's frames list Mobile before Desktop and Light before Dark; other
 * frames keep the model's order.
 */
export function pickerFrames(
  frames: readonly CanvasFramePlan[],
): EntryBarFrame[] {
  const shown = frames.filter((frame) => !frame.hidden);
  const ordered = shown.every(screenFrame)
    ? [...shown].sort((first, second) => screenRank(first) - screenRank(second))
    : shown;
  return ordered.map((frame) => ({
    kind: frame.kind,
    label: frame.label,
    value: frame.key,
  }));
}

/**
 * The frame that the compact layout shows of a screen: the frame of the
 * selection's viewport and scheme, with `both` read as Mobile, or the
 * picker's first frame while the screen has no such frame.
 */
export function pickedScreenFrame(
  frames: readonly CanvasFramePlan[],
  selection: Pick<ViewerSelection, "colorScheme" | "viewport">,
): string | undefined {
  const viewport =
    selection.viewport === "both" ? "mobile" : selection.viewport;
  const named = frames.find(
    (frame) =>
      !frame.hidden &&
      frame.viewport === viewport &&
      frame.scheme === selection.colorScheme,
  );
  return named?.key ?? pickerFrames(frames)[0]?.value;
}

/**
 * The frame that the compact layout shows of a variant set: the routed saved
 * variant's frame in the selection's scheme, or its Light frame without one.
 * The set's own route selects no frame, so the whole set shows.
 */
export function pickedSetFrame(
  frames: readonly CanvasFramePlan[],
  variantPath: string | undefined,
  scheme: CanvasScheme,
): string | undefined {
  if (variantPath === undefined) return undefined;
  const row = frames.filter((frame) => frame.variantPath === variantPath);
  return (
    row.find((frame) => frame.scheme === scheme) ??
    row.find((frame) => frame.scheme === "light")
  )?.key;
}

/** The entry's slug: the last segment of its path. */
function slug(path: string): string {
  return path.split("/").at(-1) ?? path;
}

/**
 * The frames on the compact canvas: the picked frame alone, in the
 * section's first cell, and the others mounted out of the section. One
 * screen frame then stands for the entry, so the entry's slug leads its
 * name, such as `welcome · Mobile · Light`. Without a picked frame every
 * frame shows.
 */
export function compactFrames(
  frames: readonly CanvasFramePlan[],
  picked: string | undefined,
): readonly CanvasFramePlan[] {
  if (picked === undefined) return frames;
  return frames.map((frame) => {
    if (frame.key !== picked) return { ...frame, hidden: true };
    const { hidden: _hidden, ...shown } = frame;
    return {
      ...shown,
      column: 0,
      label: screenFrame(frame)
        ? `${slug(frame.entry.path)} · ${frame.label}`
        : frame.label,
      row: 0,
    };
  });
}
