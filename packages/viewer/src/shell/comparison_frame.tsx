/** One comparison version: its opaque surface and read-only frame. */

import { useCallback, useEffect, useMemo, useRef } from "react";

import type { PaneDocument } from "./comparison_chrome.js";
import { useComparisonViewport } from "./comparison_viewport.js";
import { PreviewFrame } from "./preview_frame.js";

/**
 * Reuse the viewer-owned `srcdoc` frame and read-only guard for one version,
 * registered with the enclosing viewport so its document follows the shared
 * offset and its anchors move the shared viewport.
 */
export function ComparisonFrame({ presentation, title }: PaneDocument) {
  const scope = useComparisonViewport();
  const surface = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const viewport = scope?.viewport.current;
    if (!scope || !viewport || !surface.current || !frame.current) return;
    return scope.sync.attachLayer({
      frame: frame.current,
      surface: surface.current,
      viewport,
    });
  }, [scope]);
  const reveal = useCallback(
    (target: Element) => {
      if (scope && frame.current) scope.sync.reveal(frame.current, target);
    },
    [scope],
  );
  const comparison = useMemo(() => ({ frame, reveal }), [reveal]);
  return (
    <div className="mb-pane-doc" ref={surface}>
      <PreviewFrame
        comparison={comparison}
        presentation={presentation}
        title={title}
      />
    </div>
  );
}
