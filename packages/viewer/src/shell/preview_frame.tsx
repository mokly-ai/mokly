/** Viewer-owned frame for one accepted historical presentation. */

import { useEffect, useRef } from "react";

import type { SnapshotPresentation } from "../previews/presentation.js";
import { enforcePreviewReadOnly } from "../previews/read_only.js";

/** Render a reachable, script-disabled snapshot document from `srcdoc`. */
export function PreviewFrame(props: {
  presentation: SnapshotPresentation;
  title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(
    () =>
      frame.current
        ? enforcePreviewReadOnly(frame.current, props.presentation)
        : undefined,
    [props.presentation],
  );
  return (
    <iframe
      className="mbk-frag"
      data-mokly-preview-frame=""
      data-mokly-preview-source={props.presentation.snapshotAddress}
      ref={frame}
      sandbox="allow-same-origin"
      srcDoc={props.presentation.srcdoc}
      title={props.title}
    />
  );
}
