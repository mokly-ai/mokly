import type { FrameEvent } from "../frame_adapter.js";

/** Report host callback failures without interrupting synchronous delivery. */
export function notifyFrameListeners(
  win: Pick<Window, "reportError">,
  listeners: ReadonlySet<(event: FrameEvent) => void>,
  event: FrameEvent,
): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      win.reportError(error);
    }
  }
}
