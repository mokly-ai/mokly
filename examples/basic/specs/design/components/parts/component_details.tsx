import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { MetaRow } from "../../parts/metadata_row.js";

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
import {
  AffectedScreens,
  UsageDeliveryState,
  UsedBy,
} from "./component_usage.js";
import { CONTROLS_PAGES } from "./destinations.js";
import { toolbarPrompt } from "./fixtures.js";
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
  | "shared-impact"
  | "style-changed"
  | "closed";

function ComponentChildren() {
  return (
    <section>
      <h3>
        Nested components <span>1 instance</span>
      </h3>
      <MockLink to="design/components/overview">
        Action · Main action ↗
      </MockLink>
      <p className="ce-muted">1 instance · Default variant</p>
    </section>
  );
}

/** One supplied prop row: its design instance name, prop name and value. */
type SuppliedProp = readonly [instance: string, prop: string, value: string];

/** Supplied props of the examples outside Action's saved variants. */
const SUPPLIED_PROPS: Partial<
  Record<ComponentPageState, readonly SuppliedProp[]>
> = {
  toolbar: [["selected-prop", "prompt", `"${toolbarPrompt}"`]],
  hidden: [["selected-prop", "visible", "false"]],
  unused: [["selected-prop", "label", '"New"']],
  added: [["selected-prop", "label", '"New"']],
  "overlay-tall": [
    ["title", "title", `"${checklistTitle}"`],
    ["completed", "completed", String(checklistCompleted)],
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
        <dl className="ce-props" aria-label="Supplied props">
          {supplied.map(([instance, prop, value]) => (
            <MetaRow
              key={prop}
              name={instance}
              label={prop}
              presentation="props"
            >
              <code>{value}</code>
            </MetaRow>
          ))}
        </dl>
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
  const initial =
    state === "closed"
      ? "closed"
      : props !== undefined
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
          content: props ?? <ComponentProps state={state} />,
        },
        {
          id: "usage",
          label: "Usage",
          content: usageDelivery ? (
            <UsageDeliveryState state={usageDelivery} />
          ) : (
            <>
              <UsedBy state={state} />
              {changed ? (
                <AffectedScreens removed={state === "removed"} />
              ) : null}
            </>
          ),
        },
      ]}
    />
  );
}
