import { PreviousVersionLabel } from "../../parts/removed_preview.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";

import { screenComparison } from "./comparison_fixtures.js";
import { INSPECTION_PAGES } from "./destinations.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import { ExplorerShell } from "./navigation.js";
import { ScreenDetails } from "./screen_details.js";
import { ConsumerFrame, type ScreenPageState } from "./screen_preview.js";
import { ViewControls } from "./view_controls.js";
import { PreviewWorkspace } from "./workspace.js";

/**
 * A consuming screen in the component explorer. A removed consumer keeps the
 * same workspace over its previous version, so the catalogue navigation stays
 * the way back to the component that lists it.
 */
export function ScreenPage({
  state,
  viewport,
}: {
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  const removed = state === "removed-consumer";
  const comparison = screenComparison(state);
  const identity = screenIdentity(state);
  const { title, id } = SCREENS[identity];
  const highlighting = state === "highlight" || state === "nested";
  return (
    <ExplorerShell
      design={INSPECTION_PAGES[state]}
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
            schemeDisabled={removed || undefined}
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
      {removed ? <PreviousVersionLabel /> : null}
      <PreviewWorkspace
        inspector={<ScreenDetails state={state} />}
        render={(previewViewport) => (
          <ConsumerFrame state={state} viewport={previewViewport} />
        )}
      />
    </ExplorerShell>
  );
}
