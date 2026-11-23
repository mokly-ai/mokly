/**
 * Viewer-owned frame for one accepted historical or comparison presentation.
 * This container keeps the read-only guard of the frame's document;
 * `@mokly/ui/preview-frame` draws the `<iframe>` element.
 */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { PreviewIframe } from "@mokly/ui/preview-frame";

import { forwardCanvasInput } from "../previews/canvas_input.js";
import type { SnapshotPresentation } from "../previews/presentation.js";
import { enforcePreviewReadOnly } from "../previews/read_only.js";

import type { CanvasInputListener } from "./canvas_input.js";

/** What a comparison pane adds to the shared read-only frame. */
export interface ComparisonFrameOptions {
  /** The frame element the pane's shared viewport scrolls. */
  frame: RefObject<HTMLIFrameElement | null>;
  /** Show a same-document anchor target by moving the shared viewport. */
  reveal(target: Element): void;
}

/**
 * Forward the canvas input of the frame's presented documents while a
 * listener is given, to the latest listener, with the frame element, so a
 * zoom keeps its point in the frame.
 */
function useCanvasInput(
  frame: RefObject<HTMLIFrameElement | null>,
  listener: CanvasInputListener | undefined,
): void {
  const latest = useRef(listener);
  latest.current = listener;
  const forwards = listener !== undefined;
  useEffect(() => {
    const element = frame.current;
    if (!element || !forwards) return;
    return forwardCanvasInput(element, (event) =>
      latest.current?.(event, element),
    );
  }, [forwards, frame]);
}

/**
 * Render a reachable, script-disabled snapshot document from `srcdoc`. A
 * comparison pane's frame is marked as such and is never user-scrollable: its
 * document is scrolled only by the pane's shared viewport. A frame on the
 * canvas can forward the canvas input of its document to `canvasInput`.
 */
export function SnapshotFrame(props: {
  /**
   * Receives the zoom gestures, canvas keys and focus from inside the
   * document, with the frame element.
   */
  canvasInput?: CanvasInputListener | undefined;
  comparison?: ComparisonFrameOptions;
  presentation: SnapshotPresentation;
  title: string;
}) {
  const own = useRef<HTMLIFrameElement>(null);
  const frame = props.comparison?.frame ?? own;
  const reveal = props.comparison?.reveal;
  useEffect(
    () =>
      frame.current
        ? enforcePreviewReadOnly(
            frame.current,
            props.presentation,
            reveal ? { reveal } : {},
          )
        : undefined,
    [frame, props.presentation, reveal],
  );
  useCanvasInput(frame, props.canvasInput);
  const comparison = props.comparison !== undefined;
  return (
    <PreviewIframe
      data={{
        "data-mokly-comparison-frame": comparison ? "" : undefined,
        "data-mokly-preview-frame": comparison ? undefined : "",
        "data-mokly-preview-source": props.presentation.snapshotAddress,
      }}
      ref={frame}
      scrollable={!comparison}
      srcDoc={props.presentation.srcdoc}
      title={props.title}
    />
  );
}
