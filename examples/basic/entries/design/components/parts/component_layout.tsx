import type { ReactNode } from "react";

import type { ComparisonMode } from "../../parts/destinations.js";
import type { RebuildDepiction } from "../../parts/rebuild_status.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";

import type { ChangeStatus } from "./comparison_fixtures.js";
import type { WorkspaceDesignDestination } from "./destinations.js";
import { COMPONENTS, type ComponentId } from "./metadata.js";
import { ExplorerShell, type ChangeScenario } from "./navigation.js";
import { ViewControls, type HighlightOption } from "./view_controls.js";
import { PreviewWorkspace } from "./workspace.js";

/** One component-page shell for saved examples and editable controls designs. */
export function ComponentLayout({
  children,
  mode = "current",
  status = "unmodified",
  design,
  highlight,
  identity = "action",
  inspector,
  rebuild,
  scenario = "all",
  variants,
  viewport,
}: {
  children: (viewport: ArtboardViewport) => ReactNode;
  /** The selected comparison mode; Current when nothing is compared. */
  mode?: ComparisonMode | undefined;
  status?: ChangeStatus;
  design: WorkspaceDesignDestination;
  /** Supplied by consuming-screen workspaces that expose component highlighting. */
  highlight?: HighlightOption | undefined;
  identity?: ComponentId;
  inspector: ReactNode;
  /** Watched Serve's status for the latest saved changes, when depicted. */
  rebuild?: RebuildDepiction | undefined;
  scenario?: ChangeScenario;
  variants: ReactNode;
  viewport: ArtboardViewport;
}) {
  const { title, id } = COMPONENTS[identity];
  return (
    <ExplorerShell
      active={identity}
      design={design}
      rebuild={rebuild}
      scenario={scenario}
      viewport={viewport}
    >
      <ScreenHead
        accessibleControls
        title={title}
        crumbs={["Example", "Components"]}
        idChip={id}
        action={<ViewControls viewport={viewport} highlight={highlight} />}
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
