import type { ReactNode } from "react";

import { mockLink } from "@mokly/mokly";

import { InstanceTree } from "../../../../../../packages/ui/src/instance-tree/instance-tree.js";

import { ComparisonDetails } from "./comparison_details.js";
import { componentComparison } from "./comparison_fixtures.js";
import { ComponentInfo } from "./component_info.js";
import { ComponentProps } from "./component_props.js";
import { PropsDeliveryState } from "./component_props_delivery.js";
import { ComponentUsage, UsageDeliveryState } from "./component_usage.js";
import { COMPONENT_PAGES, INSPECTION_PAGES } from "./destinations.js";
import { toolbarAction } from "./fixtures.js";
import { Inspector } from "./inspector.js";
import { COMPONENT_ENTRY_BY_STATE } from "./metadata.js";

export type ComponentPageState =
  | "default"
  | "disabled"
  | "comparison"
  | "overlay"
  | "difference"
  | "overlay-tall"
  | "affected"
  | "toolbar"
  | "hidden"
  | "unused"
  | "added"
  | "removed"
  | "usage-loading"
  | "usage-failed"
  | "props-loading"
  | "props-failed"
  | "shared-impact"
  | "style-changed"
  | "closed";

/**
 * The Toolbar's nested components in the shipped tree: the one Action that its
 * example renders, labelled as its highlight region names it, which links to
 * the Action page.
 */
function ComponentChildren() {
  const [title, id] = toolbarAction.split(" · ");
  return (
    <InstanceTree
      usage={{
        components: 1,
        instances: [
          {
            href: mockLink(COMPONENT_PAGES.default),
            id: id!,
            key: "main-action",
            nested: [],
            title: title!,
          },
        ],
        status: "ready",
        total: 1,
      }}
      viewport="desktop"
      viewports={[]}
    />
  );
}

/** A Props-tab limit opens its own Props panel instead of the state's. */
export function ComponentDetails({
  props,
  state,
}: {
  props?: ReactNode;
  state: ComponentPageState;
}) {
  const entry = COMPONENT_ENTRY_BY_STATE[state];
  const changed =
    state === "affected" ||
    state === "comparison" ||
    state === "overlay" ||
    state === "difference" ||
    state === "removed" ||
    state === "style-changed";
  const usageDelivery =
    state === "usage-loading"
      ? "loading"
      : state === "usage-failed"
        ? "failed"
        : undefined;
  const propsDelivery =
    state === "props-loading"
      ? "loading"
      : state === "props-failed"
        ? "failed"
        : undefined;
  const initial =
    state === "closed"
      ? "closed"
      : props !== undefined || propsDelivery
        ? "props"
        : changed || state === "unused" || usageDelivery
          ? "usage"
          : state === "disabled" || state === "hidden"
            ? "props"
            : "info";
  return (
    <Inspector
      initial={initial}
      panels={[
        {
          id: "info",
          label: "Details",
          content: (
            <>
              <ComponentInfo entry={entry} />
              <ComparisonDetails
                comparison={componentComparison(state)}
                subject="component"
              />
            </>
          ),
        },
        ...(state === "toolbar"
          ? [
              {
                id: "components" as const,
                label: "Nested components",
                content: <ComponentChildren />,
              },
            ]
          : []),
        {
          id: "props",
          label: "Props",
          content: propsDelivery ? (
            <PropsDeliveryState state={propsDelivery} />
          ) : (
            (props ?? <ComponentProps state={state} />)
          ),
        },
        {
          id: "usage",
          label: "Usage",
          content: usageDelivery ? (
            <UsageDeliveryState state={usageDelivery} />
          ) : (
            <ComponentUsage
              affected={changed}
              removed={state === "removed"}
              state={state}
              welcome={
                state === "style-changed"
                  ? INSPECTION_PAGES["affected-screen"]
                  : undefined
              }
            />
          ),
        },
      ]}
    />
  );
}
