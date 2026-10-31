import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { DetailsBody } from "../../../../../../packages/ui/src/details-panel/details-panel.js";
import { InstanceTree } from "../../../../../../packages/ui/src/instance-tree/instance-tree.js";
import { MetadataCode } from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { PropsMessage } from "../../../../../../packages/ui/src/props-panel/props-panel.js";
import {
  UsageList,
  UsageStatus,
} from "../../../../../../packages/ui/src/usage-list/usage-list.js";
import { MetaRow } from "../../parts/metadata_row.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CONTROLS_COPY } from "../controls/parts/copy.js";
import { ScreenControls } from "../controls/parts/screen_controls.js";

import { ComparisonDetails } from "./comparison_details.js";
import { screenComparison } from "./comparison_fixtures.js";
import { welcomeInstances } from "./fixtures.js";
import { Inspector, type InspectorPanel } from "./inspector.js";
import { InstanceDetails } from "./instance_details.js";
import { InstanceTree as WelcomeInstances } from "./instance_tree.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import type { ScreenPageState } from "./screen_preview.js";

/** The shell's line while the view's component preview loads. */
const WAITING = "Waiting for the component preview.";

/**
 * The Components tab. While the view's records wait, are unavailable, or hold
 * no instance, it is the shipped tab; otherwise it lists the depicted
 * instances by component.
 */
function ScreenComponents({
  state,
  viewport,
}: {
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  if (
    state === "inspection-loading" ||
    state === "unavailable" ||
    state === "empty"
  )
    return (
      <InstanceTree
        usage={
          state === "inspection-loading"
            ? { status: "waiting", text: WAITING }
            : state === "unavailable"
              ? { status: "unavailable" }
              : { components: 0, instances: [], status: "ready", total: 0 }
        }
        viewport={viewport}
        viewports={[]}
      />
    );
  const consumer = state === "consumer";
  return (
    <section className="ce-usage-section" aria-label="Components in this view">
      <h3>
        Components{" "}
        <span>
          {consumer ? "1 instance" : `${welcomeInstances.length} instances`}
        </span>
      </h3>
      {consumer ? (
        <MockLink to="design/components/overview">Action · Continue ↗</MockLink>
      ) : (
        <WelcomeInstances state={state} />
      )}
    </section>
  );
}

/**
 * The Usage tab of a screen in the shipped list: while the catalogue loads or
 * is unchecked, its status, and then the screen's consumers, which a screen
 * has none of.
 */
function ScreenUsage({ state }: { state: ScreenPageState }) {
  if (state === "inspection-loading") return <UsageStatus status="loading" />;
  if (state === "unavailable") return <UsageStatus status="unchecked" />;
  return <UsageList affected={[]} usedBy={[]} />;
}

/** A Props-tab limit opens its own Props panel instead of the state's. */
export function ScreenDetails({
  props,
  state,
  viewport,
}: {
  props?: ReactNode;
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  const screen = SCREENS[screenIdentity(state)];
  const removed = state === "removed-consumer";
  const loading = state === "inspection-loading";
  const noInstances = state === "empty" || state === "unavailable" || loading;
  const initial =
    state === "closed" || removed
      ? "closed"
      : props === undefined && (noInstances || state === "highlight")
        ? "components"
        : state === "style-outside" || state === "affected-screen"
          ? "info"
          : "props";
  return (
    <Inspector
      initial={initial}
      panels={[
        {
          id: "info",
          label: "Details",
          content: (
            <>
              <DetailsBody description={screen.description}>
                <MetaRow name="source" label="Source">
                  <MetadataCode>{screen.source}</MetadataCode>
                </MetaRow>
              </DetailsBody>
              <ComparisonDetails
                comparison={screenComparison(state)}
                subject="screen"
              />
            </>
          ),
        },
        ...(removed
          ? []
          : ([
              {
                id: "components",
                label: "Components",
                content: <ScreenComponents state={state} viewport={viewport} />,
              },
              {
                id: "props",
                label: "Props",
                content:
                  props ??
                  (noInstances ? (
                    <PropsMessage pending={loading}>
                      {loading
                        ? WAITING
                        : state === "unavailable"
                          ? CONTROLS_COPY.propsUnavailable
                          : CONTROLS_COPY.noProps}
                    </PropsMessage>
                  ) : state === "screen-props" ? (
                    <ScreenControls />
                  ) : (
                    <InstanceDetails state={state} />
                  )),
              },
              {
                id: "usage",
                label: "Usage",
                content: <ScreenUsage state={state} />,
              },
            ] satisfies InspectorPanel[])),
      ]}
    />
  );
}
