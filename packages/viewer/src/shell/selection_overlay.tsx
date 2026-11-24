/**
 * The canvas selection over the frame that holds it, which
 * `@mokly/ui/canvas-selection` draws. A selected frame takes the frame's
 * whole box and its rounded size. A selected instance takes its box on the
 * frame, cut to the frame's edges, and its rounded size; the redline of its
 * left padding shows while the box's left edge stands on the frame.
 */

import type { ReactNode } from "react";

import {
  CanvasSelection,
  type CanvasSelectionBox,
} from "@mokly/ui/canvas-selection";

import type { CanvasFrameSize } from "./canvas_frame_size.js";
import type { CanvasFramePlan } from "./canvas_frames.js";
import type { CanvasSelected } from "./canvas_selection.js";
import type { InstanceBoxReading } from "./instance_box_model.js";

/** The part of a box that stands on a frame of a size, if any. */
function boxOnFrame(
  box: CanvasSelectionBox,
  size: CanvasFrameSize,
): CanvasSelectionBox | undefined {
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const right = Math.min(size.width, box.x + box.width);
  const bottom = Math.min(size.height, box.y + box.height);
  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : undefined;
}

/** What the selection draws over a frame, if the frame holds it. */
export function selectionOverlay({
  name,
  plan,
  reading,
  selected,
  size,
}: {
  /** The selected instance's component. */
  name: string | undefined;
  plan: CanvasFramePlan;
  reading: InstanceBoxReading | undefined;
  selected: CanvasSelected | undefined;
  size: CanvasFrameSize;
}): ReactNode {
  if (selected?.frame !== plan.key) return undefined;
  if (selected.kind === "frame")
    return (
      <CanvasSelection
        kind="frame"
        name={plan.label}
        size={{
          height: Math.round(size.height),
          width: Math.round(size.width),
        }}
      />
    );
  if (!reading || name === undefined) return undefined;
  const box = boxOnFrame(reading.box, size);
  if (!box) return undefined;
  const whole = box.x === reading.box.x;
  return (
    <CanvasSelection
      border={whole ? Math.round(reading.model?.border.left ?? 0) : undefined}
      box={box}
      kind="instance"
      name={name}
      padding={whole ? reading.sizes?.padding.left : undefined}
      size={{
        height: Math.round(reading.box.height),
        width: Math.round(reading.box.width),
      }}
    />
  );
}
