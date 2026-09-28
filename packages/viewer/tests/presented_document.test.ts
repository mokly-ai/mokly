import assert from "node:assert/strict";
import { test } from "node:test";

import {
  followPresentedDocument,
  presentedDocument,
  type FrameScheduler,
} from "../src/previews/presented_document.js";

function scheduler() {
  const frames = new Map<number, () => void>();
  let next = 0;
  const value: FrameScheduler = {
    cancelFrame: (handle) => void frames.delete(handle),
    requestFrame(callback) {
      next += 1;
      frames.set(next, callback);
      return next;
    },
  };
  return {
    animate() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback();
    },
    pending: () => frames.size,
    value,
  };
}

/** A frame whose window proxy stays one object, as a browser's does. */
class Frame extends EventTarget {
  contentDocument: { URL: string } | null = { URL: "about:blank" };
  crossOrigin = false;
  window = new EventTarget();
  readonly contentWindow = {
    addEventListener: (type: string, listener: () => void): void => {
      this.refuseCrossOrigin();
      this.window.addEventListener(type, listener);
    },
    removeEventListener: (type: string, listener: () => void): void => {
      this.refuseCrossOrigin();
      this.window.removeEventListener(type, listener);
    },
  };

  hide(): void {
    this.window.dispatchEvent(new Event("pagehide"));
  }

  private refuseCrossOrigin(): void {
    if (this.crossOrigin)
      throw new DOMException("Blocked a cross-origin frame", "SecurityError");
  }
}

function follow(frame: Frame, frames = scheduler()) {
  let inspections = 0;
  const stop = followPresentedDocument(
    frame as unknown as HTMLIFrameElement,
    frames.value,
    () => (inspections += 1),
  );
  return { frames, inspections: () => inspections, stop };
}

test("a presented document is recognised from its commit", () => {
  const frame = new Frame();
  assert.equal(
    presentedDocument(frame as unknown as HTMLIFrameElement),
    undefined,
  );
  frame.contentDocument = { URL: "about:srcdoc" };
  assert.equal(
    presentedDocument(frame as unknown as HTMLIFrameElement),
    frame.contentDocument,
  );
});

test("documents are inspected on attach, load and a frame after hiding", () => {
  const frame = new Frame();
  const followed = follow(frame);
  assert.equal(followed.inspections(), 1);
  frame.hide();
  frame.hide();
  assert.equal(followed.frames.pending(), 1);
  followed.frames.animate();
  assert.equal(followed.inspections(), 2);
  frame.dispatchEvent(new Event("load"));
  assert.equal(followed.inspections(), 3);
});

test("a window that turned cross-origin cannot stop the next inspection", () => {
  const frame = new Frame();
  const followed = follow(frame);
  frame.hide();
  frame.crossOrigin = true;
  followed.frames.animate();
  assert.equal(followed.inspections(), 2);
  frame.dispatchEvent(new Event("load"));
  assert.equal(followed.inspections(), 3);
  followed.stop();
});

test("stopping releases the frame and cancels a pending inspection", () => {
  const frame = new Frame();
  const followed = follow(frame);
  frame.hide();
  followed.stop();
  assert.equal(followed.frames.pending(), 0);
  frame.dispatchEvent(new Event("load"));
  frame.hide();
  assert.equal(followed.inspections(), 1);
});
