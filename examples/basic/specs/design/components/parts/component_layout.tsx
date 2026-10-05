import type { ReactNode } from "react";

import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import { EXAMPLE_CRUMB } from "../../parts/entry_paths.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";
import { Stage } from "../../parts/stage.js";

import type { ChangeStatus } from "./comparison_fixtures.js";
import type { ComponentDesignDestination } from "./destinations.js";
import { COMPONENTS, type ComponentEntryMetadata } from "./metadata.js";
import { ExplorerShell } from "./navigation.js";
import type { ChangeScenario } from "./navigation_tree.js";
import { ViewControls } from "./view_controls.js";
import { InspectorWorkspace, PreviewWorkspace } from "./workspace.js";

/**
 * One component-page shell for saved examples and editable controls designs.
 * A render function draws one preview per viewport; any other content is the
 * one stage message a page without saved variants shows instead.
 */
export function ComponentLayout({
  children,
  comparisons,
  mode = "current",
  status = "unmodified",
  design,
  entry,
  inspector,
  navigationKey,
  scenario = "all",
  variants,
  viewport,
}: {
  children: ReactNode | ((viewport: ArtboardViewport) => ReactNode);
  /** Whether the head draws the comparison band; a change status by default. */
  comparisons?: boolean | undefined;
  /** The selected comparison mode; Current when nothing is compared. */
  mode?: ComparisonMode | undefined;
  status?: ChangeStatus;
  design: ComponentDesignDestination;
  entry: ComponentEntryMetadata;
  inspector: ReactNode;
  navigationKey?: string | undefined;
  scenario?: ChangeScenario;
  variants: ReactNode;
  viewport: ArtboardViewport;
}) {
  const component = COMPONENTS[entry.component];
  return (
    <ExplorerShell
      active={entry.component}
      activeKey={navigationKey ?? COMPONENT_NAVIGATION[entry.component].id}
      design={design}
      scenario={scenario}
      viewport={viewport}
    >
      <ScreenHead
        accessibleControls
        title={component.title}
        crumbs={
          entry.location ?? [
            scenario === "all" ? EXAMPLE_CRUMB : "Example",
            "Components",
          ]
        }
        path={entry.path}
        action={<ViewControls viewport={viewport} />}
        comparisons={
          comparisons ?? (status === "changed" || status === "removed")
        }
        status={status}
        comparisonMode={mode}
      />
      {variants}
      {typeof children === "function" ? (
        <PreviewWorkspace
          inspector={inspector}
          render={children}
          viewport={viewport}
        />
      ) : (
        <InspectorWorkspace inspector={inspector}>
          <Stage>{children}</Stage>
        </InspectorWorkspace>
      )}
    </ExplorerShell>
  );
}
