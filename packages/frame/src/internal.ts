export { FrameError } from "./adapters/frame_error.js";
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
