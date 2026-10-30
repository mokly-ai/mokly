/**
 * One comparison version: its opaque surface and read-only frame. This
 * container registers them with the scroll controller;
 * `@mokly/ui/comparison-pane` draws the surface.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";

import { ComparisonSurface } from "@mokly/ui/comparison-pane";

import type { PaneDocument } from "./comparison_chrome.js";
import { useComparisonViewport } from "./comparison_viewport.js";
import { SnapshotFrame } from "./preview_frame.js";

/**
 * Reuse the viewer-owned `srcdoc` frame and read-only guard for one version,
 * registered with the enclosing viewport so its document follows the shared
 * offset and its anchors reach its regions and the shared viewport.
 */
export function ComparisonFrame({ presentation, side, title }: PaneDocument) {
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
        comparison={comparison}
        presentation={presentation}
        title={title}
      />
    </ComparisonSurface>
  );
}
