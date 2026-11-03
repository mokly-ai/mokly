import type { FrameEvent, FrameNavigation } from "../client/frame_adapter.js";

import type { inspectionError } from "./inspection.js";

/** Use the host realm for callbacks when the frame disables scripts. */
export type InspectorEnvironment = Pick<
  Window & typeof globalThis,
  | "ResizeObserver"
  | "MutationObserver"
  | "AbortController"
  | "requestAnimationFrame"
  | "cancelAnimationFrame"
>;
export type InspectorNavigation = (
  event: MouseEvent,
) => FrameNavigation | undefined;
export type InspectorRuntimeEvent =
  | Exclude<FrameEvent, { type: "error" }>
  | { type: "error"; code: ReturnType<typeof inspectionError> };
export type InspectorSubscription = Exclude<
  InspectorRuntimeEvent["type"],
  "error"
>;
