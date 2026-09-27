/** Viewer-owned frame for one accepted historical or comparison presentation. */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import type { SnapshotPresentation } from "../previews/presentation.js";
import { enforcePreviewReadOnly } from "../previews/read_only.js";

/** What a comparison pane adds to the shared read-only frame. */
export interface ComparisonFrameOptions {
  /** The frame element the pane's shared viewport scrolls. */
  frame: RefObject<HTMLIFrameElement | null>;
  /** Show a same-document anchor target by moving the shared viewport. */
  reveal(target: Element): void;
}

/**
 * Render a reachable, script-disabled snapshot document from `srcdoc`. A
 * comparison pane's frame is marked as such and is never user-scrollable: its
 * document is scrolled only by the pane's shared viewport.
 */
export function PreviewFrame(props: {
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
  const comparison = props.comparison !== undefined;
  return (
    <iframe
      className="mbk-frag"
      data-mokly-comparison-frame={comparison ? "" : undefined}
      data-mokly-preview-frame={comparison ? undefined : ""}
      data-mokly-preview-source={props.presentation.snapshotAddress}
      ref={frame}
      sandbox="allow-same-origin"
      scrolling={comparison ? "no" : undefined}
      srcDoc={props.presentation.srcdoc}
      title={props.title}
    />
  );
}
