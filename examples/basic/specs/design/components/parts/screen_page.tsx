import { PreviousVersionStage } from "../../parts/removed_preview.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";

import { INSPECTION_PAGES } from "./destinations.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import { ExplorerShell } from "./navigation.js";
import { ScreenDetails } from "./screen_details.js";
import { ConsumerFrame } from "./screen_preview.js";
import { ViewControls } from "./view_controls.js";
import { PreviewWorkspace } from "./workspace.js";

/**
 * The removed screen that consumed the removed variant, in the component
 * explorer. It keeps the same workspace over its previous version, so the
 * catalogue navigation stays the way back to the component that lists it. A
 * removed screen has no current preview, so it cannot be highlighted.
 */
export function ScreenPage({ viewport }: { viewport: ArtboardViewport }) {
  const state = "removed-consumer";
  const { title, path } = SCREENS[screenIdentity(state)];
  return (
    <ExplorerShell design={INSPECTION_PAGES[state]} viewport={viewport}>
      <PreviewWorkspace
        header={
          <ScreenHead
            accessibleControls
            title={title}
            crumbs={["Example", "Screens"]}
            path={path}
            comparisonMode="current"
            status="removed"
            action={<ViewControls viewport={viewport} />}
          />
        }
        inspector={<ScreenDetails state={state} viewport={viewport} />}
        view={{ highlight: "removed" }}
        viewport={viewport}
        render={(previewViewport) => (
          <ConsumerFrame state={state} viewport={previewViewport} />
        )}
        stage
        wrap={(previews) => (
          <PreviousVersionStage
            entry={{ kind: "screen", path, title }}
            viewport="both"
          >
            {previews}
          </PreviousVersionStage>
        )}
      />
    </ExplorerShell>
  );
}
