import type { ColorScheme, Viewport } from "@mokly/mokly";
import { ChangeStatus } from "@mokly/ui/change-status";
import { ComparisonStage } from "@mokly/ui/comparison-stage";
import { ComparisonToolbar } from "@mokly/ui/comparison-toolbar";
import type { ScreenHeaderCrumb } from "@mokly/ui/screen-header";
import { ScreenHeader } from "@mokly/ui/screen-header";
import { Stage } from "@mokly/ui/stage";
import type { ViewMark } from "@mokly/ui/view-controls";
import { ViewControls } from "@mokly/ui/view-controls";
import { WorkspaceLayout } from "@mokly/ui/workspace-layout";
import type { ReactNode } from "react";

import { staticNoop } from "../../../components/static-controls";
import { currentScreen } from "../../../fixtures/viewer-catalogue";
import { PublishedFrame } from "./published-frame";
import { shownView } from "./published-view";

/** A screen at the catalogue's root sits in no folder, so it has no crumbs. */
const crumbs: readonly ScreenHeaderCrumb[] = [];

/**
 * The ids and the wording that the viewer gives the change marks of the view
 * controls. A document shows one view of the current screen, so a control is
 * marked when a changed view hides behind it, as `shownView` decides.
 */
const viewportMark: Omit<ViewMark, "marked"> = {
  id: "mb-view-changed-viewport",
  text: "Other viewport changed",
};
const schemeMark: Omit<ViewMark, "marked"> = {
  id: "mb-view-changed-scheme",
  text: "Other theme changed",
};

/**
 * The workspace of the screen the reader is on: the header with its status
 * and view controls, then the comparison band at Current over the stage. The
 * stage holds the phone and the browser window, each with the sample screen
 * in the view that its frame shows, and the package shows the frame of the
 * drawing's viewport. The status, the band and the marks describe the view
 * of that viewport. The Dark preview toggle keeps the document's scheme,
 * which is the scheme the reader asked for. `overlay` covers the preview pane,
 * which the package's own stage overlay covers in the app.
 */
export function PublishedWorkspace({
  viewport,
  colorScheme,
  overlay,
}: {
  viewport: Viewport;
  colorScheme: ColorScheme;
  overlay?: ReactNode;
}) {
  const view = shownView(viewport, colorScheme);
  return (
    <WorkspaceLayout
      header={
        <ScreenHeader
          crumbs={crumbs}
          heading={currentScreen.title}
          interactive={false}
          path={currentScreen.path}
          status={
            <ChangeStatus mark="data-workspace-status" status={view.status} />
          }
          action={
            <ViewControls
              darkPreview={{
                mark: { ...schemeMark, marked: view.marks.scheme },
                scheme: colorScheme,
              }}
              highlight={{ active: false, available: true }}
              interactive={false}
              viewport={viewport}
              viewportMark={{ ...viewportMark, marked: view.marks.viewport }}
            />
          }
        />
      }
      inspector={null}
      preview={
        <ComparisonStage
          current
          entryId={currentScreen.path}
          toolbar={
            <ComparisonToolbar
              current
              eligible={view.eligible}
              interactive={false}
              loaded={false}
              mode="current"
              onMode={staticNoop}
              onRefresh={staticNoop}
              onTogether={staticNoop}
              together={false}
            />
          }
        >
          <Stage kind="live" routed viewport={viewport}>
            <PublishedFrame viewport="mobile" colorScheme={colorScheme} />
            <PublishedFrame viewport="desktop" colorScheme={colorScheme} />
          </Stage>
        </ComparisonStage>
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
