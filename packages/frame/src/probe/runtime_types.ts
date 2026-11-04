import type { FrameEvent, FrameNavigation } from "../frame_adapter.js";

import type { inspectionError } from "./inspection.js";

/** Use the host realm for callbacks when the frame disables scripts. */
export type ProbeEnvironment = Pick<
  Window & typeof globalThis,
  | "ResizeObserver"
  | "MutationObserver"
  | "AbortController"
  | "requestAnimationFrame"
  | "cancelAnimationFrame"
>;
export type ProbeNavigation = (
  event: MouseEvent,
) => FrameNavigation | undefined;
export type ProbeRuntimeEvent =
  | Exclude<FrameEvent, { type: "error" }>
  | { type: "error"; code: ReturnType<typeof inspectionError> };
/** Receives events synchronously and must not throw. */
export type ProbeRuntimeCallback = (event: ProbeRuntimeEvent) => void;
export type ProbeSubscription = Exclude<ProbeRuntimeEvent["type"], "error">;
