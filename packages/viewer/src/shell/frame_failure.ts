/** How a frame mount failed, from its rejection or its error events. */

import type { FrameErrorCode } from "@mokly/frame";

/**
 * Whether an error event means that the frame failed to load or mount. An
 * inspection error, such as `limit`, leaves the loaded preview usable, so the
 * frame keeps its status. Every error event still reaches the listeners.
 */
export function isFrameFailure(
  code: FrameErrorCode,
  loading: boolean,
): boolean {
  switch (code) {
    case "disposed":
    case "origin":
    case "timeout":
    case "version":
      return true;
    case "unavailable":
      return loading;
    case "invalid-boundary":
    case "invalid-message":
    case "limit":
    case "missing-instance":
      return false;
  }
}

/**
 * Whether a mount rejected because an earlier Mokly built the document. A
 * custom adapter may reject with any error that carries the `version` code.
 */
export function rejectedVersion(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "version"
  );
}
