/** Viewer-owned frame for one accepted historical presentation. */

import { useEffect, useRef } from "react";

import type { PreviewPresentation } from "../previews/presentation.js";
import { enforcePreviewReadOnly } from "../previews/read_only.js";

/** Render a reachable, script-disabled historical document from `srcdoc`. */
export function PreviewFrame(props: {
  presentation: PreviewPresentation;
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
