import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { ComparisonDetails } from "../../parts/comparison_details.js";
import { actionComparison } from "../../parts/comparison_fixtures.js";
import { ComponentInfo } from "../../parts/component_info.js";
import { ComponentLayout } from "../../parts/component_layout.js";
import { UsedBy } from "../../parts/component_usage.js";
import { COMPONENT_PAGES, CONTROLS_PAGES } from "../../parts/destinations.js";
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
 * Action's own entry first, then its saved variants. The controls stories
 * edit a saved variant, so the parent opens the component page, which local
 * Serve and a published catalogue share.
 */
function ControlsVariants({ state }: { state: ControlsState }) {
  const fixture = controlsFixtures[state];
  const published = isPublished(state);
  const current = (variant: "default" | "disabled") =>
    fixture.variant === variant;
  return (
    <VariantBar
      options={[
        { label: "Action", to: COMPONENT_PAGES.default },
        {
          label: "Default",
          to: current("default")
            ? CONTROLS_PAGES[state]
            : published
              ? CONTROLS_PAGES.readonly
              : CONTROLS_PAGES.default,
          ...(current("default") ? { current: true } : {}),
        },
        {
          label: "Disabled",
          to: current("disabled")
            ? CONTROLS_PAGES[state]
            : published
              ? CONTROLS_PAGES["readonly-variant"]
              : CONTROLS_PAGES.variant,
          ...(current("disabled") ? { current: true } : {}),
        },
        { label: "Secondary" },
      ]}
    />
  );
}

export function ControlsPage({
  state,
  viewport,
}: {
  state: ControlsState;
  viewport: ArtboardViewport;
}) {
  const fixture = controlsFixtures[state];
  const entry =
    fixture.variant === "disabled"
      ? COMPONENT_ENTRIES.actionDisabled
      : COMPONENT_ENTRIES.actionDefault;
  return (
    <ComponentLayout
      design={CONTROLS_PAGES[state]}
      entry={entry}
      navigationKey={
        fixture.variant === "disabled"
          ? COMPONENT_NAVIGATION.action.variants[1].id
          : COMPONENT_NAVIGATION.action.variants[0].id
      }
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
          <div className="ce-controls-preview" aria-busy={state === "pending"}>
            <ComponentCanvas viewport={previewViewport}>
              <ActionExample {...fixture.preview} />
            </ComponentCanvas>
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
