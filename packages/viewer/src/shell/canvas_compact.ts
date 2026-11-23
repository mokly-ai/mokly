/**
 * The compact layout's frames: one frame at a time on the canvas, and the
 * frame picker of the entry bar, which lists the shown frames of the canvas
 * frames model. A screen shows the frame that the selection's viewport and
 * scheme name, where `both` reads as Mobile, as does a removed screen's
 * previous version. A variant set shows its whole set until a selection
 * picks a frame, which the workspace's canvas selection holds. A use case
 * shows one step frame, which `canvas_use_case_pick.ts` picks.
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

/** The frames that a picker lists, in their order, each by its name. */
export function frameChoices(
  frames: readonly Pick<CanvasFramePlan, "key" | "kind" | "label">[],
): EntryBarFrame[] {
  return frames.map((frame) => ({
    kind: frame.kind,
    label: frame.label,
    value: frame.key,
  }));
}

/**
 * The frames that the picker lists of a screen or a variant set: the shown
 * frames. A screen's frames list Mobile before Desktop and Light before
 * Dark; a variant set's keep the model's order.
 */
export function pickerFrames(
  frames: readonly CanvasFramePlan[],
): EntryBarFrame[] {
  const shown = frames.filter((frame) => !frame.hidden);
  return frameChoices(
    shown.every(screenFrame)
      ? [...shown].sort(
          (first, second) => screenRank(first) - screenRank(second),
        )
      : shown,
  );
}

/**
 * The key of the frame that the compact layout shows of a screen's frames,
 * which their viewport and scheme name, such as `mobile-light`: the frame of
 * the selection's viewport and scheme, with `both` read as Mobile; else that
 * viewport's Light frame, as a screen without a dark view keeps; else the
 * first frame.
 */
export function pickedFrameKey(
  frames: readonly { key: string }[],
  selection: Pick<ViewerSelection, "colorScheme" | "viewport">,
): string | undefined {
  const viewport =
    selection.viewport === "both" ? "mobile" : selection.viewport;
  const named = (scheme: CanvasScheme) =>
    frames.find((frame) => frame.key === `${viewport}-${scheme}`);
  return (named(selection.colorScheme) ?? named("light") ?? frames[0])?.key;
}

/**
 * The frame that the compact layout shows of a screen: the frame that
 * `pickedFrameKey` names among its shown frames, or the picker's first frame.
 */
export function pickedScreenFrame(
  frames: readonly CanvasFramePlan[],
  selection: Pick<ViewerSelection, "colorScheme" | "viewport">,
): string | undefined {
  const order = pickerFrames(frames).map(({ value }) => ({ key: value }));
  return pickedFrameKey(order, selection);
}

/**
 * The frames with the picked frame alone in the section's first cell; the
 * others stay mounted out of the section.
 */
export function pickedAlone<
  Frame extends { column: number; hidden?: boolean; key: string; row: number },
>(frames: readonly Frame[], picked: string): Frame[] {
  return frames.map((frame) =>
    frame.key === picked
      ? { ...frame, column: 0, hidden: false, row: 0 }
      : { ...frame, hidden: true },
  );
}

/**
 * The name of the one screen frame that stands for an entry in the compact
 * layout: the entry's slug, the last segment of its path, leads it, such as
 * `welcome · Mobile · Light`.
 */
export function compactFrameLabel(path: string, label: string): string {
  return `${path.split("/").at(-1) ?? path} · ${label}`;
}

/**
 * The frames on the compact canvas: the picked frame alone, and the others
 * mounted out of the section. A picked screen frame's name leads with the
 * entry's slug. Without a picked frame every frame shows.
 */
export function compactFrames(
  frames: readonly CanvasFramePlan[],
  picked: string | undefined,
): readonly CanvasFramePlan[] {
  if (picked === undefined) return frames;
  return pickedAlone(frames, picked).map((frame) =>
    frame.key === picked && screenFrame(frame)
      ? { ...frame, label: compactFrameLabel(frame.entry.path, frame.label) }
      : frame,
  );
}
