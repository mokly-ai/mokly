import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { PropValues } from "../../../../../../packages/ui/src/props-panel/props-panel.js";

import {
  actionCompact,
  actionEntries,
  ActionPropValues,
  type ActionEntry,
} from "./action_props.js";
import { checklistCompleted, checklistTitle } from "./checklist.js";
import { ComparisonDetails } from "./comparison_details.js";
import { componentComparison } from "./comparison_fixtures.js";
import { ComponentInfo } from "./component_info.js";
import { PropsDeliveryState } from "./component_props_delivery.js";
import { ComponentUsage, UsageDeliveryState } from "./component_usage.js";
import { CONTROLS_PAGES, INSPECTION_PAGES } from "./destinations.js";
import { toolbarAction, toolbarPrompt } from "./fixtures.js";
import { Inspector } from "./inspector.js";
import {
  COMPONENT_ENTRIES,
  COMPONENT_ENTRY_BY_STATE,
  type ComponentEntryMetadata,
} from "./metadata.js";

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

function ComponentChildren() {
  return (
    <section className="ce-usage-section">
      <h3>
        Nested components <span>1 instance</span>
      </h3>
      <MockLink to="design/components/overview">{`${toolbarAction} ↗`}</MockLink>
      <p className="ce-muted">1 instance · Default variant</p>
    </section>
  );
}

/** One supplied prop: its name and its value as text. */
interface SuppliedProp {
  name: string;
  value: string;
}

/** Supplied props of the examples outside Action's saved variants. */
const SUPPLIED_PROPS: Partial<
  Record<ComponentPageState, readonly SuppliedProp[]>
> = {
  toolbar: [{ name: "prompt", value: `"${toolbarPrompt}"` }],
  hidden: [{ name: "visible", value: "false" }],
  unused: [{ name: "label", value: '"New"' }],
  added: [{ name: "label", value: '"New"' }],
  "overlay-tall": [
    { name: "title", value: `"${checklistTitle}"` },
    { name: "completed", value: String(checklistCompleted) },
  ],
};

/** The Action entry a page shows: a saved variant or the parent's own entry. */
export function actionEntryOf(entry: ComponentEntryMetadata): ActionEntry {
  return entry.path === COMPONENT_ENTRIES.actionDisabled.path
    ? "disabled"
    : entry.path === COMPONENT_ENTRIES.actionDefault.path
      ? "default"
      : "parent";
}

/** Edit props opens the controls of the entry it is on. */
const CONTROLS_BY_ENTRY = {
  parent: CONTROLS_PAGES.parent,
  default: CONTROLS_PAGES.default,
  disabled: CONTROLS_PAGES.variant,
} as const satisfies Record<ActionEntry, string>;

function ComponentProps({ state }: { state: ComponentPageState }) {
  const entry = COMPONENT_ENTRY_BY_STATE[state];
  const supplied = SUPPLIED_PROPS[state];
  return (
    <section>
      <h3>Supplied props</h3>
      {supplied ? (
        <PropValues values={supplied} />
      ) : (
        <ActionPropValues
          props={
            state === "removed"
              ? actionCompact.props
              : actionEntries[actionEntryOf(entry)].props
          }
        />
      )}
      {entry.component === "action" && state !== "removed" ? (
        <MockLink to={CONTROLS_BY_ENTRY[actionEntryOf(entry)]}>
          Edit props ↗
        </MockLink>
      ) : null}
    </section>
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
