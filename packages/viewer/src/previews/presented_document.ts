/** Follow the viewer-owned `srcdoc` document a frame presents. */

/** Animation-frame scheduling a follower depends on. */
export interface FrameScheduler {
  cancelFrame(handle: number): void;
  requestFrame(callback: () => void): number;
}

/** The browser's animation-frame scheduler. */
export const browserFrameScheduler: FrameScheduler = {
  cancelFrame: (handle) => cancelAnimationFrame(handle),
  requestFrame: (callback) => requestAnimationFrame(callback),
};

/**
 * The presented, same-origin `srcdoc` document of a frame, from the moment it
 * commits; its root element may still be waiting for the parser.
 */
export function presentedDocument(
  frame: HTMLIFrameElement,
): Document | undefined {
  let doc: Document | null;
  try {
    doc = frame.contentDocument;
  } catch {
    return;
  }
  return doc?.URL === "about:srcdoc" ? doc : undefined;
}

/**
 * Call `inspect` now, whenever the frame loads, and one animation frame after
 * its current window hides. The window proxy turns cross-origin when the frame
 * navigates away, so releasing that listener may be refused and is skipped. A replacement document commits right after that
 * `pagehide`, while slow resources may hold back the frame's `load` event for
 * a long time, so a presentation is guarded and measured as soon as it exists
 * and a navigation away from it is noticed before it finishes loading.
 */
export function followPresentedDocument(
  frame: HTMLIFrameElement,
  scheduler: FrameScheduler,
  inspect: () => void,
): () => void {
  let pending: number | undefined;
  let unhook: (() => void) | undefined;
  const hidden = (): void => {
    pending ??= scheduler.requestFrame(check);
  };
  const hook = (): void => {
    unhook?.();
    unhook = undefined;
    try {
      const view = frame.contentWindow;
      if (!view) return;
      view.addEventListener("pagehide", hidden);
      unhook = () => {
        try {
          view.removeEventListener("pagehide", hidden);
        } catch {
          return;
        }
      };
    } catch {
      return;
    }
  };
  function check(): void {
    pending = undefined;
    hook();
    inspect();
  }
  frame.addEventListener("load", check);
  check();
  return () => {
    frame.removeEventListener("load", check);
    unhook?.();
    if (pending !== undefined) scheduler.cancelFrame(pending);
  };
}
