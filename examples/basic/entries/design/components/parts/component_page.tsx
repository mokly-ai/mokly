import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
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
import { COMPONENT_ENTRY_BY_STATE } from "./metadata.js";
import {
  ActionExample,
  ComponentCanvas,
  ComponentComparison,
  ToolbarExample,
} from "./preview.js";

/** Shared component-page composition; each owning screen exports both artboards. */
export function ComponentPage({
  state,
  viewport,
}: {
  state: ComponentPageState;
  viewport: ArtboardViewport;
}) {
  const comparison = state === "comparison" || state === "removed";
  const evidence = componentComparison(state);
  const entry = COMPONENT_ENTRY_BY_STATE[state];
  const navigationKey =
    state === "disabled"
      ? COMPONENT_NAVIGATION.action.variants[1].id
      : state === "comparison" || state === "affected"
        ? COMPONENT_NAVIGATION.action.variants[0].id
        : state === "removed"
          ? "example-action-compact"
          : state === "added"
            ? COMPONENT_NAVIGATION.badge.variants[0].id
            : undefined;
  return (
    <ComponentLayout
      design={COMPONENT_PAGES[state]}
      entry={entry}
      navigationKey={navigationKey}
      comparison={comparison}
      status={
        state === "removed" ? "removed" : (evidence?.status ?? "unmodified")
      }
      scenario={
        state === "removed"
          ? "removed"
          : state === "added"
            ? "added"
            : state === "disabled" ||
                (evidence && evidence.status !== "unmodified")
              ? "component"
              : "all"
      }
      viewport={viewport}
      variants={<VariantPicker state={state} />}
      inspector={<ComponentDetails state={state} />}
    >
      {(previewViewport) =>
        state === "added" ? (
          <ComponentCanvas viewport={previewViewport}>
            <span className="ce-badge">New</span>
          </ComponentCanvas>
        ) : comparison ? (
          <ComponentComparison
            removed={state === "removed"}
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
