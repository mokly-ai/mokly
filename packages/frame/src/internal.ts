import { FrameError } from "./adapters/frame_error.js";
import type { Box } from "./frame_adapter.js";
import { contentBox } from "./probe/content_box.js";

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
export { clipNode } from "./probe/clipping.js";

export function measureContentBox(doc: Document): Box | null {
  try {
    return contentBox(doc);
  } catch (error) {
    if (error === "limit") throw new FrameError("limit");
    throw error;
  }
}
