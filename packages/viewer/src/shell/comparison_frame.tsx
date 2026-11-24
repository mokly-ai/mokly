/**
 * One comparison version: its opaque surface and read-only frame. This
 * container registers them with the scroll controller, forwards the canvas
 * input of the version's document to the canvas that holds the frame, and
 * measures a component version's document once it loads;
 * `@mokly/ui/comparison-pane` draws the surface.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";

import { ComparisonSurface } from "@mokly/ui/comparison-pane";

import type { SnapshotPresentation } from "../previews/presentation.js";

import type { CanvasFrameSize } from "./canvas_frame_size.js";
import type { CanvasInputListener } from "./canvas_input.js";
import { measureLoadedDocument } from "./comparison_frame_size.js";
import type { ComparisonSide } from "./comparison_scroll_owner.js";
import { useComparisonViewport } from "./comparison_viewport.js";
import { SnapshotFrame } from "./preview_frame.js";

/** One version's accepted presentation and the frame title naming it. */
export interface PaneDocument {
  presentation: SnapshotPresentation;
  /** Which version the document is. */
  side: ComparisonSide;
  title: string;
}

/**
 * Reuse the viewer-owned `srcdoc` frame and read-only guard for one version,
 * registered with the enclosing viewport so its document follows the shared
 * offset and its anchors reach its regions and the shared viewport. The
 * document's zoom gestures, canvas keys and focus reach `canvasInput`, and a
 * component version's size reaches `onMeasure` once its document loads.
 */
export function ComparisonFrame({
  canvasInput,
  onMeasure,
  presentation,
  side,
  title,
}: PaneDocument & {
  canvasInput: CanvasInputListener;
  onMeasure?:
    ((side: ComparisonSide, size: CanvasFrameSize) => void) | undefined;
}) {
  const scope = useComparisonViewport();
  const surface = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const viewport = scope?.viewport.current;
    if (!scope || !viewport || !surface.current || !frame.current) return;
    return scope.sync.attachLayer({
      frame: frame.current,
      side,
      surface: surface.current,
      viewport,
    });
  }, [scope, side]);
  const measure = useRef(onMeasure);
  measure.current = onMeasure;
  const measures = onMeasure !== undefined;
  useEffect(() => {
    const element = frame.current;
    if (!element || !measures) return;
    return measureLoadedDocument(element, (size) =>
      measure.current?.(side, size),
    );
  }, [measures, presentation, side]);
  const reveal = useCallback(
    (target: Element) => {
      if (scope && frame.current) scope.sync.reveal(frame.current, target);
    },
    [scope],
  );
  const comparison = useMemo(() => ({ frame, reveal }), [reveal]);
  return (
    <ComparisonSurface ref={surface}>
      <SnapshotFrame
        canvasInput={canvasInput}
        comparison={comparison}
        presentation={presentation}
        title={title}
      />
    </ComparisonSurface>
  );
}
