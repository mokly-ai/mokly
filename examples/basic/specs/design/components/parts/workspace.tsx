import type { ReactNode } from "react";

import { WorkspaceLayout } from "../../../../../../packages/ui/src/workspace-layout/workspace-layout.js";
import { DesignInstances } from "../../library/composition.js";
import {
  DepictedViewScope,
  type DepictedView,
} from "../../parts/depicted_view.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { Stage } from "../../parts/stage.js";

interface WorkspaceParts {
  /** The screen header with the workspace's view controls. */
  header?: ReactNode;
  inspector: ReactNode;
  /**
   * The record of the depicted view, which the header's view controls and
   * the preview's highlight read. A workspace without view controls, such
   * as the inspector's library sample, depicts no view.
   */
  view?: DepictedView | undefined;
}

/**
 * The shipped workspace of a depicted screen: its header and the preview
 * pane beside the inspector. A static artboard runs no script, so the
 * preview pane holds a native sizer that resizes it against the open desktop
 * inspector, and a dock places the inspector and its mobile sheet.
 */
function InspectorWorkspace({
  children,
  header,
  inspector,
  view,
}: WorkspaceParts & { children: ReactNode }) {
  const layout = (
    <WorkspaceLayout
      header={header}
      inspector={<div className="ce-inspector-dock">{inspector}</div>}
      preview={
        <>
          <div
            className="ce-preview-sizer"
            aria-hidden="true"
            title="Resize inspector"
          />
          <div className="ce-preview-pane">{children}</div>
        </>
      }
    />
  );
  return view === undefined ? (
    layout
  ) : (
    <DepictedViewScope view={view}>{layout}</DepictedViewScope>
  );
}

/**
 * Both real viewport previews share the same controls and inspector, on the
 * shipped stage. This helper is not registered, so it keeps
 * `render(viewport)`; only registered boundaries must take explicit content
 * slots.
 */
export function PreviewWorkspace({
  render,
  viewport,
  ...parts
}: WorkspaceParts & {
  render: (viewport: ArtboardViewport) => ReactNode;
  viewport: ArtboardViewport | "both";
}) {
  return (
    <InspectorWorkspace {...parts}>
      <Stage>
        <div className="ce-preview-set" data-viewport={viewport}>
          {(["mobile", "desktop"] as const).map((viewport) => (
            <div
              key={viewport}
              className="ce-preview-view"
              data-preview-viewport={viewport}
            >
              <DesignInstances name={viewport}>
                {render(viewport)}
              </DesignInstances>
            </div>
          ))}
        </div>
      </Stage>
    </InspectorWorkspace>
  );
}
