import type { ReactNode } from "react";

import { DesignInstances } from "../../library/composition.js";
import { NavResizeHandle } from "../../parts/nav_resize.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { Stage } from "../../parts/stage.js";

/** A bounded preview shares space with the desktop inspector or sits behind a mobile sheet. */
export function InspectorWorkspace({
  inspector,
  children,
}: {
  inspector: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ce-workspace" aria-label="Preview and inspector">
      <div className="ce-preview-region">
        <div
          className="ce-preview-sizer"
          aria-hidden="true"
          title="Resize inspector"
        />
        <div className="ce-preview-pane" aria-label="Preview pane">
          {children}
        </div>
        <div className="ce-inspector-resize" aria-hidden="true">
          <NavResizeHandle />
        </div>
      </div>
      <div className="ce-inspector-dock">{inspector}</div>
    </section>
  );
}

/** Both real viewport previews share the same controls and inspector. */
export function PreviewWorkspace({
  inspector,
  render,
  stage = true,
  viewport,
}: {
  inspector: ReactNode;
  render: (viewport: ArtboardViewport) => ReactNode;
  stage?: boolean;
  viewport: ArtboardViewport | "both";
}) {
  const previews = (
    <div className="ce-preview-set" data-viewport={viewport}>
      {(["mobile", "desktop"] as const).map((viewport) => (
        <div
          key={viewport}
          className="ce-preview-view"
          data-preview-viewport={viewport}
        >
          <DesignInstances name={viewport}>{render(viewport)}</DesignInstances>
        </div>
      ))}
    </div>
  );
  return (
    <InspectorWorkspace inspector={inspector}>
      {stage ? <Stage>{previews}</Stage> : previews}
    </InspectorWorkspace>
  );
}
