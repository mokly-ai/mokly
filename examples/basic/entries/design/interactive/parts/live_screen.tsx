import { Inspector } from "../../components/parts/inspector.js";
import { SCREENS } from "../../components/parts/metadata.js";
import { ExplorerShell } from "../../components/parts/navigation.js";
import { ScreenInfo } from "../../components/parts/screen_info.js";
import {
  ConsumerFrame,
  type ScreenPageState,
} from "../../components/parts/screen_preview.js";
import { ViewControls } from "../../components/parts/view_controls.js";
import { PreviewWorkspace } from "../../components/parts/workspace.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";

import { INTERACTIVE_PAGES } from "./destinations.js";
import { StaticNotice } from "./static_notice.js";

/** The screen's own page, whose preview and Details this artboard shares. */
const STATIC_PAGE = "details" satisfies ScreenPageState;

/**
 * A consuming screen in Live with its Components tab open. The inspector keeps
 * every tab; Components, Props and Usage list, read or edit the rendered view,
 * so each carries one secondary line instead of its content, and the preview
 * itself is the same one Static shows.
 */
export function LiveScreenWorkspace({
  viewport,
}: {
  viewport: ArtboardViewport;
}) {
  const { title, id } = SCREENS.welcome;
  const notice = <StaticNotice />;
  return (
    <ExplorerShell
      active="welcome"
      design={INTERACTIVE_PAGES.screen}
      viewport={viewport}
    >
      <ScreenHead
        accessibleControls
        title={title}
        crumbs={["Example", "Screens"]}
        idChip={id}
        comparisonMode="current"
        status="unmodified"
        action={
          <ViewControls
            viewport={viewport}
            highlight={{ active: false, unavailable: "live" }}
          />
        }
      />
      <PreviewWorkspace
        viewport={viewport}
        inspector={
          <Inspector
            initial="components"
            panels={[
              {
                id: "info",
                label: "Details",
                content: <ScreenInfo state={STATIC_PAGE} />,
              },
              { id: "components", label: "Components", content: notice },
              { id: "props", label: "Props", content: notice },
              { id: "usage", label: "Usage", content: notice },
            ]}
          />
        }
        render={(previewViewport) => (
          <ConsumerFrame state={STATIC_PAGE} viewport={previewViewport} />
        )}
      />
    </ExplorerShell>
  );
}
