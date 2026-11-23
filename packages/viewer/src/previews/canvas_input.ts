/**
 * The canvas input of a frame without an adapter, such as a previous
 * version's frame: the document that the frame presents forwards the
 * reader's zoom gestures, canvas keys and focus from inside it. A document
 * that the frame replaces stops forwarding, and its replacement starts.
 */

import {
  listenForCanvasInput,
  type CanvasInputEvent,
} from "@mokly/frame/internal";

import {
  browserFrameScheduler,
  followPresentedDocument,
  presentedDocument,
  type FrameScheduler,
} from "./presented_document.js";

/** Forward the canvas input of each document that `frame` presents. */
export function forwardCanvasInput(
  frame: HTMLIFrameElement,
  listener: (event: CanvasInputEvent) => void,
  scheduler: FrameScheduler = browserFrameScheduler,
): () => void {
  let current: Document | undefined;
  let stop: (() => void) | undefined;
  const follow = followPresentedDocument(frame, scheduler, () => {
    const doc = presentedDocument(frame);
    if (doc === current) return;
    stop?.();
    current = doc;
    stop = doc ? listenForCanvasInput(doc, listener) : undefined;
  });
  return () => {
    follow();
    stop?.();
  };
}
