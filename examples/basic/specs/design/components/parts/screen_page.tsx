import type { ReactNode } from "react";

import { ComparisonStage } from "../../parts/compare.js";
import type { DepictedView } from "../../parts/depicted_view.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import { EXAMPLE_CRUMB } from "../../parts/entry_paths.js";
import { PreviousVersionStage } from "../../parts/removed_preview.js";
import { ScreenHead, type ArtboardViewport } from "../../parts/shell.js";

import { screenComparison } from "./comparison_fixtures.js";
import { INSPECTION_PAGES } from "./destinations.js";
import {
  CONSUMER_REGIONS,
  NESTED_REGIONS,
  WELCOME_REGIONS,
} from "./explorer_regions.js";
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
 * The depicted view of a consuming screen: the Highlight components state
 * that the shell shows for it, and the regions that its preview highlights.
 * Every mode but Current is a comparison, which cannot highlight, and a
 * removed screen has no current preview. The inspection states give their
 * own reason, and the highlight states turn it on. Details highlights its
 * single Action, a nested selection the Toolbar's Action, and the other
 * states Welcome's own instances.
 */
function screenView(
  state: ScreenPageState,
  mode: ComparisonMode,
): DepictedView {
  if (mode !== "current") return { highlight: "comparison" };
  if (state === "removed-consumer") return { highlight: "removed" };
  if (state === "inspection-loading") return { highlight: "loading" };
  if (state === "unavailable" || state === "empty") return { highlight: state };
  return {
    highlight: state === "highlight" || state === "nested" ? "on" : "available",
    regions:
      state === "consumer"
        ? CONSUMER_REGIONS
        : state === "nested"
          ? NESTED_REGIONS
          : WELCOME_REGIONS,
  };
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
  /** The shipped container of the previews: a comparison, or a removal. */
  const container = (previews: ReactNode) =>
    affected ? (
      <ComparisonStage path={path}>{previews}</ComparisonStage>
    ) : removed ? (
      <PreviousVersionStage
        entry={{ kind: "screen", path, title }}
        viewport="both"
      >
        {previews}
      </PreviousVersionStage>
    ) : (
      previews
    );
  return (
    <ExplorerShell
      design={limit?.design ?? INSPECTION_PAGES[state]}
      active={identity}
      scenario={scenario}
      viewport={viewport}
    >
      <PreviewWorkspace
        header={
          <ScreenHead
            accessibleControls
            title={title}
            crumbs={[scenario === "all" ? EXAMPLE_CRUMB : "Example", "Screens"]}
            path={path}
            comparisonMode={comparisonMode}
            comparisons={comparison?.status === "changed" || affected}
            status={comparison?.status ?? "unmodified"}
            action={<ViewControls viewport={viewport} />}
          />
        }
        inspector={
          <ScreenDetails
            props={limit?.panel}
            state={state}
            viewport={viewport}
          />
        }
        view={screenView(state, comparisonMode)}
        viewport={viewport}
        render={(previewViewport) =>
          affected ? (
            <AffectedComparison viewport={previewViewport} />
          ) : (
            <ConsumerFrame state={state} viewport={previewViewport} />
          )
        }
        stage={!affected}
        wrap={container}
      />
    </ExplorerShell>
  );
}
