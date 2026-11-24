import { FrameError } from "./adapters/frame_error.js";
import type { Box, FrameEvent } from "./frame_adapter.js";
import { contentBox } from "./probe/content_box.js";
import { unavailableMetadata } from "./probe/metadata.js";
import { probeRuntime } from "./probe/runtime.js";
import type { ProbeEnvironment } from "./probe/runtime_types.js";
import { CANVAS_EVENTS } from "./probe/values.js";

export { FrameError };
export { cancelFrameMount } from "./adapters/frame_mount.js";
export {
  registerFrameSession,
  releaseFrameSession,
} from "./adapters/frame_session.js";
export { frameUsage } from "./adapters/frame_usage.js";
export { intersectRectangles } from "./adapters/geometry.js";
export type { CoordinateRect } from "./adapters/geometry.js";
export {
  localFramePath,
  temporaryPreviewAdapter,
} from "./adapters/same_origin_adapter.js";
export type { LinkActivation } from "./navigation/activation.js";
export { canvasKey } from "./probe/canvas_input.js";
export { clipNode } from "./probe/clipping.js";

export type CanvasInputEvent = Extract<
  FrameEvent,
  { type: (typeof CANVAS_EVENTS)[number] }
>;

/** Forward canvas input from a same-origin document without an adapter. */
export function listenForCanvasInput(
  doc: Document,
  listener: (event: CanvasInputEvent) => void,
  environment: ProbeEnvironment = window,
): () => void {
  if (!doc.defaultView) return () => {};
  const runtime = probeRuntime(
    doc.defaultView,
    unavailableMetadata("unavailable"),
    environment,
    () => undefined,
    (event) => {
      if (
        event.type === "canvas-wheel" ||
        event.type === "canvas-pinch" ||
        event.type === "canvas-key" ||
        event.type === "canvas-focus" ||
        event.type === "canvas-blur"
      )
        listener(event);
    },
  );
  runtime.__subscribe(CANVAS_EVENTS);
  return runtime.__dispose;
}

export function measureContentBox(doc: Document): Box | null {
  try {
    return contentBox(doc);
  } catch (error) {
    if (error === "limit") throw new FrameError("limit");
    throw error;
  }
}
