import type { ComparisonMode } from "../../parts/destinations.js";
import { EXAMPLE_CRUMB } from "../../parts/entry_paths.js";
import { PreviousVersionLabel } from "../../parts/removed_preview.js";
import {
  ScreenHead,
  type ArtboardViewport,
  type HighlightState,
} from "../../parts/shell.js";

import { screenComparison } from "./comparison_fixtures.js";
import { INSPECTION_PAGES } from "./destinations.js";
import type { PropsLimit } from "./limit.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import { ExplorerShell } from "./navigation.js";
import { ScreenDetails } from "./screen_details.js";
import {
  AffectedComparison,
  ConsumerFrame,
  type ScreenPageState,
} from "./screen_preview.js";
import { ViewControls } from "./view_controls.js";
import { PreviewWorkspace } from "./workspace.js";

/**
 * The Highlight components state that the shell shows for a consuming screen.
 * Every mode but Current is a comparison, which cannot highlight, and a
 * removed screen has no current preview. The inspection states give their
 * own reason, and the highlight states turn it on.
 */
function screenHighlight(
  state: ScreenPageState,
  mode: ComparisonMode,
): HighlightState {
  if (mode !== "current") return "comparison";
  if (state === "removed-consumer") return "removed";
  if (state === "inspection-loading") return "loading";
  if (state === "unavailable" || state === "empty") return state;
  return state === "highlight" || state === "nested" ? "on" : "available";
}

/**
 * A consuming screen in the component explorer. A removed consumer keeps the
 * same workspace over its previous version, so the catalogue navigation stays
 * the way back to the component that lists it.
 */
export function ScreenPage({
  limit,
  state,
  viewport,
}: {
  limit?: PropsLimit;
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  const removed = state === "removed-consumer";
  const scenario = removed
    ? "removed"
    : state === "direct-change"
      ? "screen"
      : state === "style-outside"
        ? "styles-outside"
        : state === "affected-screen"
          ? "styles-all"
          : "all";
  const comparison = screenComparison(state);
  const identity = screenIdentity(state);
  const { title, path } = SCREENS[identity];
  // Changed components affect this screen, so it compares while Unmodified.
  const affected = comparison !== undefined && "affected" in comparison;
  const comparisonMode = affected ? "side-by-side" : "current";
  return (
    <ExplorerShell
      design={limit?.design ?? INSPECTION_PAGES[state]}
      active={identity}
      scenario={scenario}
      viewport={viewport}
    >
      <ScreenHead
        accessibleControls
        title={title}
        crumbs={[scenario === "all" ? EXAMPLE_CRUMB : "Example", "Screens"]}
        path={path}
        comparisonMode={comparisonMode}
        comparisons={comparison?.status === "changed" || affected}
        status={comparison?.status ?? "unmodified"}
        action={
          <ViewControls
            viewport={viewport}
            highlight={screenHighlight(state, comparisonMode)}
          />
        }
      />
      {removed ? <PreviousVersionLabel /> : null}
      <PreviewWorkspace
        inspector={<ScreenDetails state={state} props={limit?.panel} />}
        viewport={viewport}
        render={(previewViewport) =>
          affected ? (
            <AffectedComparison viewport={previewViewport} />
          ) : (
            <ConsumerFrame state={state} viewport={previewViewport} />
          )
        }
      />
    </ExplorerShell>
  );
}
