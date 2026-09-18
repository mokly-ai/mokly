import type { ReactNode } from "react";

import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";
import { EmptyState } from "../../parts/stage_content.js";

import { screenComparison } from "./comparison_fixtures.js";
import {
  INSPECTION_PAGES,
  type ComponentDesignDestination,
} from "./destinations.js";
import type { InspectorTab } from "./inspector_icons.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import { ExplorerShell } from "./navigation.js";
import { ScreenDetails } from "./screen_details.js";
import { ConsumerFrame, type ScreenPageState } from "./screen_preview.js";
import { ViewControls } from "./view_controls.js";
import { PreviewWorkspace } from "./workspace.js";

export function ScreenPage({
  componentPanel,
  componentSummary,
  design,
  inspectorInitial,
  state,
  viewport,
}: {
  componentPanel?: ReactNode;
  componentSummary?: ReactNode;
  design?: ComponentDesignDestination;
  inspectorInitial?: InspectorTab | "closed";
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  const removed = state === "removed-consumer";
  const comparison = screenComparison(state);
  const identity = screenIdentity(state);
  const { title, id } = SCREENS[identity];
  const highlighting = state === "highlight" || state === "nested";
  return (
    <>
      <ExplorerShell
        design={design ?? INSPECTION_PAGES[state]}
        active={identity}
        scenario={
          removed ? "removed" : state === "direct-change" ? "screen" : "all"
        }
        viewport={viewport}
      >
        <ScreenHead
          accessibleControls
          title={title}
          crumbs={["Example", "Screens"]}
          idChip={id}
          comparisonMode="current"
          comparisons={comparison?.status === "changed"}
          status={comparison?.status ?? "unmodified"}
          action={
            <ViewControls
              viewport={viewport}
              highlight={{
                active: highlighting,
                unavailable: removed
                  ? "removed"
                  : state === "unavailable" || state === "empty"
                    ? state
                    : undefined,
              }}
            />
          }
        />
        <PreviewWorkspace
          inspector={
            <ScreenDetails
              components={componentPanel}
              componentSummary={componentSummary}
              initial={inspectorInitial}
              state={state}
            />
          }
          render={(previewViewport) =>
            removed ? (
              <EmptyState
                body="There is no current preview to show."
                linkLabel="Back to Action’s affected screens"
                title="This screen was removed"
                to="design-component-removed"
              />
            ) : (
              <ConsumerFrame state={state} viewport={previewViewport} />
            )
          }
        />
      </ExplorerShell>
    </>
  );
}
