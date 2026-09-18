import type { FrameErrorCode } from "./frame_adapter.js";

/** Host diagnostics carry a stable code, never consumer document text. */
export class FrameError extends Error {
  constructor(readonly code: FrameErrorCode) {
    super(`Frame inspection: ${code}`);
    this.name = "FrameError";
  }
}
