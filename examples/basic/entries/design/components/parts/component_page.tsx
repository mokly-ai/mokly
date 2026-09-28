import type { ComparisonMode } from "../../parts/destinations.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import { actionVariants } from "./action_props.js";
import { componentComparison } from "./comparison_fixtures.js";
import {
  ComponentDetails,
  type ComponentPageState,
} from "./component_details.js";
import { ComponentLayout } from "./component_layout.js";
import { VariantPicker } from "./controls.js";
import { COMPONENT_PAGES } from "./destinations.js";
import { COMPONENT_BY_STATE } from "./metadata.js";
import type { ChangeScenario } from "./navigation.js";
import {
  ActionExample,
  ComponentCanvas,
  ComponentComparison,
  ToolbarExample,
} from "./preview.js";

/** The mode each comparing state selects; every other state shows Current. */
const COMPARISON_MODES: Partial<
  Record<ComponentPageState, Exclude<ComparisonMode, "current">>
> = {
  comparison: "side-by-side",
  overlay: "overlay",
  difference: "difference",
  "overlay-tall": "overlay",
  removed: "side-by-side",
};

/** The Changes scenario whose navigation each state's artboard depicts. */
function changeScenario(state: ComponentPageState): ChangeScenario {
  if (state === "removed" || state === "added") return state;
  if (COMPONENT_BY_STATE[state] === "checklist") return "checklist";
  return state === "disabled" || componentComparison(state)
    ? "component"
    : "all";
}

/** Shared component-page composition; each owning screen exports both artboards. */
export function ComponentPage({
  state,
  viewport,
}: {
  state: ComponentPageState;
  viewport: ArtboardViewport;
}) {
  const mode = COMPARISON_MODES[state];
  const identity = COMPONENT_BY_STATE[state];
  return (
    <ComponentLayout
      design={COMPONENT_PAGES[state]}
      identity={identity}
      mode={mode}
      status={componentComparison(state)?.status ?? "unmodified"}
      scenario={changeScenario(state)}
      viewport={viewport}
      variants={<VariantPicker state={state} />}
      inspector={<ComponentDetails state={state} />}
    >
      {(previewViewport) =>
        state === "added" ? (
          <ComponentCanvas viewport={previewViewport}>
            <span className="ce-badge">New</span>
          </ComponentCanvas>
        ) : mode ? (
          <ComponentComparison
            mode={mode}
            removed={state === "removed"}
            subject={identity === "checklist" ? "checklist" : "action"}
            viewport={previewViewport}
          />
        ) : (
          <ComponentCanvas viewport={previewViewport}>
            {state === "toolbar" ? (
              <ToolbarExample />
            ) : state === "hidden" ? (
              <p className="ce-empty-copy">
                This variant has no visible content.
              </p>
            ) : state === "unused" ? (
              <span className="ce-badge">New</span>
            ) : (
              <ActionExample
                {...actionVariants[
                  state === "disabled" ? "disabled" : "default"
                ].props}
              />
            )}
          </ComponentCanvas>
        )
      }
    </ComponentLayout>
  );
}
