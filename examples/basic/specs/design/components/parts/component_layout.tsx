import type { ReactNode } from "react";

import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import { EXAMPLE_CRUMB } from "../../parts/entry_paths.js";
import {
  ScreenHead,
  type ArtboardViewport,
  type HighlightState,
} from "../../parts/shell.js";

import type { ChangeStatus } from "./comparison_fixtures.js";
import type { ComponentDesignDestination } from "./destinations.js";
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
 * as Toolbar renders Action. The shell highlights the registered components
 * inside a component page's example, so only these pages can highlight.
 */
const NESTING_COMPONENTS: ReadonlySet<ComponentId> = new Set(["toolbar"]);

/**
 * The Highlight components state that the shell shows on a component page. A
 * comparison disables it first. While the entry's details are loading or
 * failed, the shell waits for the view's usage. Then only a page whose example
 * renders a registered component can highlight.
 */
function componentHighlight(
  mode: ComparisonMode,
  entry: ComponentEntryMetadata,
  detailsPending: boolean,
): HighlightState {
  if (mode !== "current") return "comparison";
  if (detailsPending) return "loading";
  return NESTING_COMPONENTS.has(entry.component) ? "available" : "empty";
}

/** One component-page shell for saved examples and editable controls designs. */
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
      <ScreenHead
        accessibleControls
        title={component.title}
        crumbs={[scenario === "all" ? EXAMPLE_CRUMB : "Example", "Components"]}
        path={entry.path}
        action={
          <ViewControls
            highlight={componentHighlight(mode, entry, detailsPending)}
            viewport={viewport}
          />
        }
        comparisons={status === "changed" || status === "removed"}
        status={status}
        comparisonMode={mode}
      />
      {variants}
      <PreviewWorkspace
        inspector={inspector}
        render={children}
        viewport={viewport}
      />
    </ExplorerShell>
  );
}
