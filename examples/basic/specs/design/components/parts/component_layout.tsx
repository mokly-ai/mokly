import type { ReactNode } from "react";

import { ComparisonStage } from "../../parts/compare.js";
import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { DepictedView, ViewRegions } from "../../parts/depicted_view.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import { EXAMPLE_CRUMB } from "../../parts/entry_paths.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";

import type { ChangeStatus } from "./comparison_fixtures.js";
import type { ComponentDesignDestination } from "./destinations.js";
import { TOOLBAR_PAGE_REGIONS } from "./explorer_regions.js";
import {
  COMPONENTS,
  type ComponentEntryMetadata,
  type ComponentId,
} from "./metadata.js";
import { ExplorerShell } from "./navigation.js";
import type { ChangeScenario } from "./navigation_tree.js";
import { ViewControls } from "./view_controls.js";
import { PreviewWorkspace } from "./workspace.js";

/**
 * The depicted components whose own example renders a registered component,
 * as Toolbar renders Action, with the regions that its example highlights.
 * The shell highlights the registered components inside a component page's
 * example, so only these pages can highlight.
 */
const NESTING_COMPONENTS: Partial<Record<ComponentId, ViewRegions>> = {
  toolbar: TOOLBAR_PAGE_REGIONS,
};

/**
 * The depicted view of a component page: the Highlight components state that
 * the shell shows for it, and the regions of its example. A comparison
 * disables it first. While the entry's details are loading or failed, the
 * shell waits for the view's usage. Then only a page whose example renders a
 * registered component can highlight.
 */
function componentView(
  mode: ComparisonMode,
  entry: ComponentEntryMetadata,
  detailsPending: boolean,
): DepictedView {
  if (mode !== "current") return { highlight: "comparison" };
  if (detailsPending) return { highlight: "loading" };
  const regions = NESTING_COMPONENTS[entry.component];
  return regions ? { highlight: "available", regions } : { highlight: "empty" };
}

/**
 * One component-page shell for saved examples and editable controls designs.
 * A comparison stands in the shipped comparison stage of the preview pane, as
 * the shell nests it, and Current stands on the dotted stage.
 */
export function ComponentLayout({
  children,
  detailsPending = false,
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
  children: (viewport: ArtboardViewport) => ReactNode;
  /** Whether the entry's details, its usage and props, are loading or failed. */
  detailsPending?: boolean;
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
      <PreviewWorkspace
        header={
          <ScreenHead
            accessibleControls
            title={component.title}
            crumbs={[
              scenario === "all" ? EXAMPLE_CRUMB : "Example",
              "Components",
            ]}
            path={entry.path}
            action={<ViewControls viewport={viewport} />}
            comparisons={status === "changed" || status === "removed"}
            status={status}
            comparisonMode={mode}
          />
        }
        inspector={inspector}
        variantBar={variants}
        view={componentView(mode, entry, detailsPending)}
        render={children}
        stage={mode === "current"}
        viewport={viewport}
        wrap={
          mode === "current"
            ? undefined
            : (previews) => (
                <ComparisonStage component path={entry.path}>
                  {previews}
                </ComparisonStage>
              )
        }
      />
    </ExplorerShell>
  );
}
