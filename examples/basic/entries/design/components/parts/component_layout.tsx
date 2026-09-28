import type { ReactNode } from "react";

import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";

import type { ChangeStatus } from "./comparison_fixtures.js";
import type { ComponentDesignDestination } from "./destinations.js";
import { COMPONENTS, type ComponentEntryMetadata } from "./metadata.js";
import { ExplorerShell, type ChangeScenario } from "./navigation.js";
import { ViewControls } from "./view_controls.js";
import { PreviewWorkspace } from "./workspace.js";

/** One component-page shell for saved examples and editable controls designs. */
export function ComponentLayout({
  children,
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
        crumbs={["Example", "Components"]}
        idChip={entry.id}
        action={<ViewControls viewport={viewport} />}
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
