import { MockLink } from "@mokly/mokly";

import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
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

import {
  controlsFixtures,
  isPublished,
  type ControlsState,
} from "./fixtures.js";
import { ControlsPanel } from "./panel.js";

function ControlsVariants({ state }: { state: ControlsState }) {
  const fixture = controlsFixtures[state];
  const published = isPublished(state);
  return (
    <nav className="ce-variants" aria-label="Saved variants">
      <span>Variant</span>
      <MockLink
        to={
          fixture.variant === "default"
            ? CONTROLS_PAGES[state]
            : published
              ? CONTROLS_PAGES.readonly
              : CONTROLS_PAGES.default
        }
        aria-current={fixture.variant === "default" ? "page" : undefined}
      >
        Default
      </MockLink>
      <MockLink
        to={
          fixture.variant === "disabled"
            ? CONTROLS_PAGES[state]
            : published
              ? CONTROLS_PAGES["readonly-variant"]
              : CONTROLS_PAGES.variant
        }
        aria-current={fixture.variant === "disabled" ? "page" : undefined}
      >
        Disabled
      </MockLink>
    </nav>
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
      comparison={state === "comparison"}
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
                  />
                </>
              ),
            },
            {
              id: "props",
              label: "Controls",
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
                Updating preview…
              </p>
            ) : null}
          </div>
        )
      }
    </ComponentLayout>
  );
}
