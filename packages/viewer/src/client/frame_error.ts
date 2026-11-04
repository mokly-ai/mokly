import type { FrameErrorCode } from "@mokly/frame";

/** Host diagnostics carry a stable code, never consumer document text. */
export class FrameError extends Error {
  constructor(readonly code: FrameErrorCode) {
    super(`Frame inspection: ${code}`);
    this.name = "FrameError";
  }
}
