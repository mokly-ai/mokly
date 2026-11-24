import type { ReactNode } from "react";

import type { ColorScheme, Viewport } from "@mokly/mokly";
import { CanvasDock } from "@mokly/ui/canvas-dock";
import { CanvasStage } from "@mokly/ui/canvas-stage";
import { ChangeStatus } from "@mokly/ui/change-status";
import { EntryBar } from "@mokly/ui/entry-bar";
import { WorkspaceLayout } from "@mokly/ui/workspace-layout";

import { staticNoop } from "../../../components/static-controls";
import { currentScreen } from "../../../fixtures/viewer-catalogue";

import { canvasView } from "./published-canvas";
import { sectionFrames } from "./published-frame";
import {
  pickedFrame,
  pickerFrames,
  screenFrames,
  shownStatus,
} from "./published-frames";
import { PublishedInspect } from "./published-inspect";
import { PublishedChanges, PublishedPanel } from "./published-panel";

/**
 * The workspace of the screen the reader is on, as the viewer draws it on the
 * canvas, with every control a native control or a picture of itself, so the
 * drawing runs no script. A desktop drawing shows the screen's section with
 * Desktop beside Mobile and Light above Dark, the zoom pill, and the right
 * panel with Inspect and Changes. A phone drawing shows the compact layout:
 * the entry bar with the frame picker, the one frame of the document's scheme
 * and the dock, with the panel's sheet closed. Each frame holds the sample
 * screen in its own scheme. The status and the band describe the shown
 * frames. The canvas keeps the view of `canvasView`, because a static
 * document cannot measure its stage.
 *
 * `tab` selects the right panel's tab, and the Changes tab draws
 * `changesStart` before the comparison band. The embedded layout of the
 * drawing takes no dock, so the workspace draws the dock where the layout's
 * dock would stand, over the canvas's bottom. `overlay` covers the preview
 * pane, which the package's own stage overlay covers in the app, under the
 * right panel and the dock.
 */
export function PublishedWorkspace({
  viewport,
  colorScheme,
  overlay,
  tab = "inspect",
  changesStart,
}: {
  viewport: Viewport;
  /** The scheme that the reader asked for, the document's own. */
  colorScheme: ColorScheme;
  overlay?: ReactNode;
  tab?: "inspect" | "changes";
  /** What the Changes tab's body draws first, such as the cloud's check. */
  changesStart?: ReactNode;
}) {
  const compact = viewport === "mobile";
  const picked = pickedFrame(colorScheme);
  const frames = compact ? [picked] : screenFrames;
  const status = shownStatus(frames);
  const shownTab = currentScreen.changed ? tab : "inspect";
  return (
    <WorkspaceLayout
      entryBar={
        <EntryBar
          picker={
            compact
              ? {
                  frames: pickerFrames,
                  onChange: staticNoop,
                  value: picked.key,
                }
              : undefined
          }
          status={<ChangeStatus status={status} />}
          title={currentScreen.title}
        />
      }
      overlay={
        <CanvasDock
          interactive={false}
          onCatalogue={staticNoop}
          onFit={staticNoop}
          onTab={staticNoop}
          tab={shownTab}
        />
      }
      panel={
        <PublishedPanel
          changes={
            currentScreen.changed ? (
              <PublishedChanges
                eligible={status === "Changed"}
                start={changesStart}
              />
            ) : undefined
          }
          inspect={<PublishedInspect status={status} />}
          tab={shownTab}
        />
      }
      preview={
        <CanvasStage
          interactive={false}
          routed
          section={{
            compact,
            frames: sectionFrames(frames),
            interactive: false,
            kind: "screen",
            path: currentScreen.path,
            status: <ChangeStatus status={status} />,
            title: currentScreen.title,
          }}
          view={canvasView(viewport, frames)}
        />
      }
      previewStatus={
        overlay === undefined ? undefined : (
          <div className="fo-stage-overlay-static" data-mkc-stage-overlay="">
            {overlay}
          </div>
        )
      }
    />
  );
}
