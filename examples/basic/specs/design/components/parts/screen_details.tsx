import type { ReactNode } from "react";

import { mockLink } from "@mokly/mokly";

import { DetailsBody } from "../../../../../../packages/ui/src/details-panel/details-panel.js";
import {
  InstanceTree,
  type InstanceNode,
} from "../../../../../../packages/ui/src/instance-tree/instance-tree.js";
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
import { INSPECTION_PAGES } from "./destinations.js";
import { welcomeInstances } from "./fixtures.js";
import { Inspector, type InspectorPanel } from "./inspector.js";
import { InstanceDetails } from "./instance_details.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import type { ScreenPageState } from "./screen_preview.js";

/** The shell's line while the view's component preview loads. */
const WAITING = "Waiting for the component preview.";

/** The artboard that shows each depicted Welcome instance selected. */
const SELECTION_PAGES = {
  main: INSPECTION_PAGES["toolbar-selection"],
  "toolbar-action": INSPECTION_PAGES.nested,
  "footer-action": INSPECTION_PAGES.details,
  help: INSPECTION_PAGES["help-selection"],
} as const satisfies Record<(typeof welcomeInstances)[number]["id"], string>;

/** The depicted Welcome instances under one owner, each linking to its selection. */
function welcomeTree(owner: string | null = null): InstanceNode[] {
  return welcomeInstances
    .filter((instance) => instance.parent === owner)
    .map((instance) => ({
      href: mockLink(SELECTION_PAGES[instance.id]),
      id: instance.label,
      key: instance.id,
      nested: welcomeTree(instance.id),
      title: instance.component,
    }));
}

/** The Details screen's one Action, which Used by selects. */
const CONSUMER_INSTANCE: InstanceNode = {
  href: mockLink(INSPECTION_PAGES.consumer),
  id: "Continue",
  key: "continue",
  nested: [],
  title: "Action",
};

/** The instance that each Welcome state selects, if it selects one. */
function selectedInstance(state: ScreenPageState) {
  if (state === "consumer") return CONSUMER_INSTANCE.key;
  if (state === "nested") return "toolbar-action";
  if (state === "toolbar-selection") return "main";
  if (state === "help-selection") return "help";
  return state === "screen-props" ? undefined : "footer-action";
}

/**
 * The Components tab in the shipped tree: while the view's records wait, are
 * unavailable, or hold no instance, its status; otherwise the depicted
 * instances by owner, each linking to the artboard that shows it selected.
 */
function ScreenComponents({
  state,
  viewport,
}: {
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  const consumer = state === "consumer";
  return (
    <InstanceTree
      initiallyExpanded={
        state === "nested" || state === "toolbar-selection" ? ["main"] : []
      }
      selectedKey={selectedInstance(state)}
      usage={
        state === "inspection-loading"
          ? { status: "waiting", text: WAITING }
          : state === "unavailable"
            ? { status: "unavailable" }
            : state === "empty"
              ? { components: 0, instances: [], status: "ready", total: 0 }
              : {
                  components: consumer
                    ? 1
                    : new Set(welcomeInstances.map((item) => item.component))
                        .size,
                  instances: consumer ? [CONSUMER_INSTANCE] : welcomeTree(),
                  status: "ready",
                  total: consumer ? 1 : welcomeInstances.length,
                }
      }
      viewport={viewport}
      viewports={[]}
    />
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
