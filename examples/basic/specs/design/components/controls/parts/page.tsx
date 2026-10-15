import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import type { ActionEntry } from "../../parts/action_props.js";
import { ComparisonDetails } from "../../parts/comparison_details.js";
import { actionComparison } from "../../parts/comparison_fixtures.js";
import { ComponentInfo } from "../../parts/component_info.js";
import { ComponentLayout } from "../../parts/component_layout.js";
import { UsedBy } from "../../parts/component_usage.js";
import { CONTROLS_PAGES } from "../../parts/destinations.js";
import { Inspector } from "../../parts/inspector.js";
import { COMPONENT_ENTRIES } from "../../parts/metadata.js";
import {
  ActionExample,
  ComponentCanvas,
  ComponentComparison,
} from "../../parts/preview.js";
import { VariantBar } from "../../parts/variant_bar.js";

import { CONTROLS_COPY } from "./copy.js";
import {
  controlsFixtures,
  isPublished,
  type ControlsState,
} from "./fixtures.js";
import { ControlsPanel } from "./panel.js";

/**
 * Action's own entry first, then its saved variants. Each option opens that
 * entry's controls in the same context. No artboard depicts the parent's own
 * entry in a published catalogue, so there its option is a depiction.
 */
function ControlsVariants({ state }: { state: ControlsState }) {
  const fixture = controlsFixtures[state];
  const published = isPublished(state);
  const option = (
    entry: ActionEntry,
    label: string,
    local: string,
    readonly?: string,
  ) => {
    const current = fixture.variant === entry;
    const to = current ? CONTROLS_PAGES[state] : published ? readonly : local;
    return { label, ...(to ? { to } : {}), ...(current ? { current } : {}) };
  };
  return (
    <VariantBar
      options={[
        option("parent", "Action", CONTROLS_PAGES.parent),
        option(
          "default",
          "Default",
          CONTROLS_PAGES.default,
          CONTROLS_PAGES.readonly,
        ),
        option(
          "disabled",
          "Disabled",
          CONTROLS_PAGES.variant,
          CONTROLS_PAGES["readonly-variant"],
        ),
        { label: "Secondary" },
      ]}
    />
  );
}

/** The entry a controls story shows, and its navigation row. */
const SHOWN = {
  parent: [COMPONENT_ENTRIES.action, COMPONENT_NAVIGATION.action.id],
  default: [
    COMPONENT_ENTRIES.actionDefault,
    COMPONENT_NAVIGATION.action.variants[0].id,
  ],
  disabled: [
    COMPONENT_ENTRIES.actionDisabled,
    COMPONENT_NAVIGATION.action.variants[1].id,
  ],
} as const;

export function ControlsPage({
  state,
  viewport,
}: {
  state: ControlsState;
  viewport: ArtboardViewport;
}) {
  const fixture = controlsFixtures[state];
  const [entry, navigationKey] = SHOWN[fixture.variant];
  return (
    <ComponentLayout
      design={CONTROLS_PAGES[state]}
      entry={entry}
      navigationKey={navigationKey}
      mode={state === "comparison" ? "side-by-side" : "current"}
      status={state === "comparison" ? actionComparison.status : "unmodified"}
      scenario={state === "comparison" ? "component" : "all"}
      viewport={viewport}
      variants={<ControlsVariants state={state} />}
      inspector={
        <Inspector
          initial="props"
          panels={[
            {
              id: "info",
              label: "Details",
              content: (
                <>
                  <ComponentInfo entry={entry} />
                  <ComparisonDetails
                    comparison={
                      state === "comparison" ? actionComparison : undefined
                    }
                    subject="component"
                  />
                </>
              ),
            },
            {
              id: "props",
              label: CONTROLS_COPY.tab,
              content: <ControlsPanel state={state} />,
            },
            {
              id: "usage",
              label: "Usage",
              content: <UsedBy state="default" />,
            },
          ]}
        />
      }
    >
      {(previewViewport) =>
        state === "comparison" ? (
          <ComponentComparison viewport={previewViewport} />
        ) : (
          <div className="ce-controls-preview">
            {/* The status stays outside the busy region, so it is announced. */}
            <div aria-busy={state === "pending"}>
              <ComponentCanvas viewport={previewViewport}>
                <ActionExample {...fixture.preview} />
              </ComponentCanvas>
            </div>
            {state === "pending" ? (
              <p className="ce-preview-status" role="status">
                <span aria-hidden="true" className="ce-pending-dot" />
                {CONTROLS_COPY.updating}
              </p>
            ) : null}
          </div>
        )
      }
    </ComponentLayout>
  );
}
