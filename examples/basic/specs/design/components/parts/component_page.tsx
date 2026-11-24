import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import { actionEntries } from "./action_props.js";
import { componentComparison } from "./comparison_fixtures.js";
import {
  ComponentDetails,
  type ComponentPageState,
} from "./component_details.js";
import { ComponentLayout } from "./component_layout.js";
import { actionEntryOf } from "./component_props.js";
import { VariantPicker } from "./controls.js";
import { COMPONENT_PAGES } from "./destinations.js";
import type { PropsLimit } from "./limit.js";
import { COMPONENT_ENTRY_BY_STATE } from "./metadata.js";
import type { ChangeScenario } from "./navigation_tree.js";
import {
  ActionExample,
  ComponentCanvas,
  ComponentComparison,
  ToolbarExample,
  type ComparedComponent,
  type ComparedState,
} from "./preview.js";
import { MenuExample, StoryErrorDocument } from "./stories.js";

/** The mode each comparing state selects; every other state shows Current. */
const COMPARISON_MODES: Partial<
  Record<ComponentPageState, Exclude<ComparisonMode, "current">>
> = {
  comparison: "side-by-side",
  overlay: "overlay",
  difference: "difference",
  "overlay-tall": "overlay",
  removed: "side-by-side",
  "style-changed": "side-by-side",
  "story-failed-changes": "side-by-side",
};

/**
 * The navigation row of each state that shows a variant or the removed
 * Compact; every other state shows its parent's own row.
 */
const NAVIGATION_KEYS: Partial<Record<ComponentPageState, string>> = {
  disabled: COMPONENT_NAVIGATION.action.variants[1].id,
  comparison: COMPONENT_NAVIGATION.action.variants[0].id,
  overlay: COMPONENT_NAVIGATION.action.variants[0].id,
  difference: COMPONENT_NAVIGATION.action.variants[0].id,
  affected: COMPONENT_NAVIGATION.action.variants[0].id,
  removed: "example-action-compact",
  added: COMPONENT_NAVIGATION.badge.variants[0].id,
  "overlay-tall": COMPONENT_NAVIGATION.checklist.variants[0].id,
  "story-failed": COMPONENT_NAVIGATION.menu.variants[0].id,
  "story-failed-changes": COMPONENT_NAVIGATION.menu.variants[0].id,
};

/**
 * The state that a comparing page's sections name when its variant was
 * removed or only its styles changed. Every other comparison names a change.
 */
const COMPARED_STATES: Partial<Record<ComponentPageState, ComparedState>> = {
  removed: "removed",
  "style-changed": "styles-changed",
};

/**
 * The states in which the entry's details, which hold its usage and its
 * props, are loading or failed.
 */
const DETAILS_PENDING: ReadonlySet<ComponentPageState> = new Set([
  "usage-loading",
  "usage-failed",
  "props-loading",
  "props-failed",
]);

/** The Changes scenario whose navigation each state's artboard depicts. */
function changeScenario(state: ComponentPageState): ChangeScenario {
  if (state === "removed" || state === "added") return state;
  if (state === "style-changed") return "styles";
  const { component } = COMPONENT_ENTRY_BY_STATE[state];
  if (component === "checklist") return "checklist";
  if (component === "menu")
    return state === "story-failed-changes" ? "stories" : "stories-all";
  return state === "disabled" ||
    componentComparison(state)?.status === "changed"
    ? "component"
    : "all";
}

/** The saved variants that a comparing state compares. */
function comparedComponent(state: ComponentPageState): ComparedComponent {
  const { component } = COMPONENT_ENTRY_BY_STATE[state];
  return component === "checklist" || component === "menu"
    ? component
    : "action";
}

/** Shared component-page composition; each owning screen exports both artboards. */
export function ComponentPage({
  limit,
  state,
  viewport,
}: {
  limit?: PropsLimit;
  state: ComponentPageState;
  viewport: ArtboardViewport;
}) {
  const mode = COMPARISON_MODES[state];
  const entry = COMPONENT_ENTRY_BY_STATE[state];
  return (
    <ComponentLayout
      design={limit?.design ?? COMPONENT_PAGES[state]}
      detailsPending={DETAILS_PENDING.has(state)}
      entry={entry}
      navigationKey={NAVIGATION_KEYS[state]}
      mode={mode}
      status={
        state === "removed"
          ? "removed"
          : (componentComparison(state)?.status ?? "unmodified")
      }
      scenario={changeScenario(state)}
      viewport={viewport}
      variants={<VariantPicker state={state} limit={limit?.design} />}
      inspector={<ComponentDetails state={state} props={limit?.panel} />}
    >
      {(previewViewport) =>
        state === "added" ? (
          <ComponentCanvas viewport={previewViewport}>
            <span className="ce-badge">New</span>
          </ComponentCanvas>
        ) : mode ? (
          <ComponentComparison
            mode={mode}
            state={COMPARED_STATES[state] ?? "changed"}
            subject={comparedComponent(state)}
            viewport={previewViewport}
          />
        ) : (
          <ComponentCanvas viewport={previewViewport}>
            {state === "toolbar" ? (
              <ToolbarExample />
            ) : state === "story-failed" ? (
              <StoryErrorDocument />
            ) : state === "storybook-link" ? (
              <MenuExample />
            ) : state === "hidden" ? (
              <p className="ce-empty-copy">
                This variant has no visible content.
              </p>
            ) : state === "unused" ? (
              <span className="ce-badge">New</span>
            ) : (
              <ActionExample {...actionEntries[actionEntryOf(entry)].props} />
            )}
          </ComponentCanvas>
        )
      }
    </ComponentLayout>
  );
}
