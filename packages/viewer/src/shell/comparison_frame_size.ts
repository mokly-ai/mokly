/**
 * The size of a component's frame in a compare: the larger width and the
 * larger height of its two versions, each measured once from the content
 * box of its document when the document has loaded. Until both versions are
 * measured, the frame keeps the desktop size, at which each document lays
 * out for its measurement, as a live component frame does before its first
 * measurement. No other comparison frame size depends on a measurement.
 */

import { measureContentBox } from "@mokly/frame/internal";

import {
  browserFrameScheduler,
  followPresentedDocument,
  presentedDocument,
  type FrameScheduler,
} from "../previews/presented_document.js";

import {
  componentFrameSize,
  type CanvasFrameSize,
} from "./canvas_frame_size.js";
import type { ComparisonSide } from "./comparison_scroll_owner.js";

/** The measured sizes of a frame's versions, by side. */
export type MeasuredVersions = Readonly<
  Partial<Record<ComparisonSide, CanvasFrameSize>>
>;

/**
 * A component frame's size from its versions' measurements: the larger
 * width and the larger height of the versions that `sides` names, once each
 * of them is measured, and the desktop size until then.
 */
export function comparedComponentSize(
  measured: MeasuredVersions | undefined,
  sides: readonly ComparisonSide[],
): CanvasFrameSize {
  const sizes = sides.map((side) => measured?.[side]);
  if (!sizes.length || sizes.some((size) => size === undefined))
    return componentFrameSize();
  const known = sizes as readonly CanvasFrameSize[];
  return {
    height: Math.max(...known.map((size) => size.height)),
    width: Math.max(...known.map((size) => size.width)),
  };
}

/**
 * A version's size from its document's content box: the document's own
 * size, or the desktop size when the document has no content or the
 * measurement fails.
 */
function documentFrameSize(doc: Document): CanvasFrameSize {
  try {
    return componentFrameSize(measureContentBox(doc));
  } catch {
    return componentFrameSize();
  }
}

/**
 * Measure the document that `frame` presents once, as soon as it has
 * loaded, and report its size. The returned function stops waiting.
 */
export function measureLoadedDocument(
  frame: HTMLIFrameElement,
  report: (size: CanvasFrameSize) => void,
  scheduler: FrameScheduler = browserFrameScheduler,
): () => void {
  let measured = false;
  return followPresentedDocument(frame, scheduler, () => {
    if (measured) return;
    const doc = presentedDocument(frame);
    if (doc?.readyState !== "complete") return;
    measured = true;
    report(documentFrameSize(doc));
  });
}
