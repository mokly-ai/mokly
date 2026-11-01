/** Mask geometry from the same authenticated boundary snapshot as labels. */

import type { HighlightMaskPlacement } from "@mokly/ui/highlight-mask";

import { visibleFrameBox } from "../client/component_geometry.js";
import type { Box, InstanceBoundary } from "../client/frame_adapter.js";

import type { ShellFrameSession } from "./frame_registry.js";

export interface FrameInspectionMask {
  boxes: readonly Box[];
  generation: number;
  height: number;
  placement: HighlightMaskPlacement;
  width: number;
}

/** Translate frame-relative boxes and clip the drawing to the visible frame. */
export function frameInspectionMask(
  session: ShellFrameSession,
  boundaries: readonly InstanceBoundary[],
  keys: readonly string[],
  origin?: Pick<DOMRect, "left" | "top">,
): FrameInspectionMask | undefined {
  const frame = session.element;
  if (
    !frame.getClientRects().length ||
    !frame.offsetWidth ||
    !frame.offsetHeight
  )
    return;
  const visible = visibleFrameBox(frame);
  const rectangle = frame.getBoundingClientRect();
  const left = visible?.left ?? rectangle.left;
  const top = visible?.top ?? rectangle.top;
  const scaleX = rectangle.width / frame.offsetWidth;
  const scaleY = rectangle.height / frame.offsetHeight;
  return {
    boxes: boundaries
      .filter(({ key }) => keys.includes(key))
      .flatMap(({ ranges }) =>
        ranges.flatMap(({ boxes }) =>
          boxes.map((box) => ({
            x: rectangle.left + (box.x + frame.clientLeft) * scaleX - left,
            y: rectangle.top + (box.y + frame.clientTop) * scaleY - top,
            width: box.width * scaleX,
            height: box.height * scaleY,
          })),
        ),
      ),
    generation: session.generation,
    height: visible ? visible.bottom - visible.top : 0,
    placement: {
      expanded: Boolean(frame.closest(".browser-frame.is-expanded")),
      hidden: !visible,
      left: left - (origin?.left ?? 0),
      top: top - (origin?.top ?? 0),
      position: origin ? "absolute" : "fixed",
      viewport: session.identity.viewport,
    },
    width: visible ? visible.right - visible.left : 0,
  };
}
