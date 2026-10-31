import type { ReactNode } from "react";

import { DesignInstances } from "../../library/composition.js";
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
      </div>
      <div className="ce-inspector-dock">{inspector}</div>
    </section>
  );
}

/**
 * Both real viewport previews share the same controls and inspector. This
 * helper is not registered, so it keeps `render(viewport)` and `wrap`; only
 * registered boundaries must take explicit content slots.
 */
export function PreviewWorkspace({
  inspector,
  render,
  stage = true,
  viewport,
  wrap,
}: {
  inspector: ReactNode;
  render: (viewport: ArtboardViewport) => ReactNode;
  stage?: boolean;
  viewport: ArtboardViewport | "both";
  /**
   * Places the previews in a shipped container of the preview pane, such as
   * a comparison stage or a previous version, as the shell nests its stage.
   */
  wrap?: ((previews: ReactNode) => ReactNode) | undefined;
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
  const content = stage ? <Stage>{previews}</Stage> : previews;
  return (
    <InspectorWorkspace inspector={inspector}>
      {wrap ? wrap(content) : content}
    </InspectorWorkspace>
  );
}
