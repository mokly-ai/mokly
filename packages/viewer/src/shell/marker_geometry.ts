import type { Box } from "../client/frame_adapter.js";
import {
  intersectRectangles,
  type CoordinateRect,
} from "../client/geometry.js";
import type { MarkerStatus } from "../host/types.js";

import type { MarkerRect } from "./marker_store.js";

export interface MarkerCoordinates {
  frameLeft: number;
  frameTop: number;
  frameClientLeft: number;
  frameClientTop: number;
  scaleX: number;
  scaleY: number;
  clip: CoordinateRect;
  originLeft: number;
  originTop: number;
}

/** Scale, clip and union frame-content boxes into marker-layer coordinates. */
export function markerRect(
  boxes: readonly Box[],
  coordinates: MarkerCoordinates,
): MarkerRect | undefined {
  const visible = boxes.flatMap((box) => {
    const left =
      coordinates.frameLeft +
      (box.x + coordinates.frameClientLeft) * coordinates.scaleX;
    const top =
      coordinates.frameTop +
      (box.y + coordinates.frameClientTop) * coordinates.scaleY;
    const clipped = intersectRectangles(
      {
        left,
        top,
        right: left + box.width * coordinates.scaleX,
        bottom: top + box.height * coordinates.scaleY,
      },
      coordinates.clip,
    );
    return clipped ? [clipped] : [];
  });
  if (!visible.length) return;
  const union = visible.reduce((result, box) => ({
    left: Math.min(result.left, box.left),
    top: Math.min(result.top, box.top),
    right: Math.max(result.right, box.right),
    bottom: Math.max(result.bottom, box.bottom),
  }));
  return {
    left: union.left - coordinates.originLeft,
    top: union.top - coordinates.originTop,
    width: union.right - union.left,
    height: union.bottom - union.top,
  };
}

export interface MarkerStatusInput {
  current: boolean;
  matched: boolean;
  usageReady: boolean;
  present: boolean;
  measurement: "pending" | "ready" | "failed";
  visible: boolean;
}

/** Pending is internal; every settled public outcome is a documented status. */
export function markerStatus(
  input: MarkerStatusInput,
): MarkerStatus | "pending" {
  if (
    !input.current ||
    !input.matched ||
    !input.usageReady ||
    !input.present ||
    input.measurement === "failed"
  )
    return "unavailable";
  if (input.measurement === "pending") return "pending";
  return input.visible ? "visible" : "hidden";
}
