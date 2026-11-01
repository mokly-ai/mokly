/**
 * Supplied props and slots for a saved view or a selected component
 * instance. These containers decode the props, word their values, and choose
 * the line that says why the tab has none. `@mokly/ui/props-panel` renders
 * them.
 */

import type { ReactNode } from "react";

import {
  PropsMessage,
  PropsPanel,
  PropsStatus,
  type PropValue,
} from "@mokly/ui/props-panel";

import { decodeProps } from "../components/codec.js";
import type {
  ComponentWireProps,
  PropValue as WirePropValue,
} from "../components/prop_types.js";
import type {
  ComponentInstanceRecord,
  ComponentViewRecord,
} from "../components/view_types.js";
import { viewHref } from "../navigation/routes.js";

import { CONTROLS_COPY } from "./component_controls_copy.js";
import type { ControlTarget } from "./control_values.js";
import type { DetailDelivery } from "./data_requests.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WAITING_REASON } from "./workspace_inspection_runtime.js";

/** Current inspector selection independent of its rendering surface. */
export interface WorkspaceInspectorSelection {
  instance?: ComponentInstanceRecord;
  props?: ComponentWireProps;
  slots?: readonly string[];
  usage?: ComponentViewRecord;
}

/** Human-readable supplied values preserve negative zero and nested data. */
export function propText(value: WirePropValue): string {
  if (value === null) return "null";
  if (typeof value === "number")
    return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(propText).join(", ")}]`;
  return `{${Object.entries(value)
    .map(([key, item]) => `${JSON.stringify(key)}: ${propText(item)}`)
    .join(", ")}}`;
}

/** Each named prop with its value as text, or Not set. */
export function propValues(
  names: readonly string[],
  values: Readonly<Record<string, WirePropValue>>,
): PropValue[] {
  return names.map((name) => {
    const value = values[name];
    return {
      name,
      value: value === undefined ? CONTROLS_COPY.notSet : propText(value),
    };
  });
}

/**
 * The Props tab of an entry without own props and no selected instance:
 * waiting for its usage, without props, unavailable, or a selection prompt.
 */
function emptyProps(
  data: WorkspaceData,
  usage: ComponentViewRecord | undefined,
): string {
  if (data.viewUsagePending) return WAITING_REASON;
  if (usage && !usage.instances.length) return CONTROLS_COPY.noProps;
  if (!usage && data.entry.kind === "screen")
    return CONTROLS_COPY.propsUnavailable;
  return "Select a component instance to see its supplied props.";
}

/**
 * The Props tab: a selected instance's props; else the shown entry's own
 * fields or saved props, once the route's details arrive; else why the
 * tab has none to show.
 */
export function WorkspacePropsTab({
  controls,
  data,
  delivery,
  instance,
  target,
  usage,
}: {
  controls: ReactNode;
  data: WorkspaceData;
  /** The route's details. The routed entry's own detail carries the fields' order. */
  delivery: DetailDelivery;
  instance: ComponentInstanceRecord | undefined;
  target: ControlTarget | undefined;
  usage: ComponentViewRecord | undefined;
}) {
  if (instance)
    return (
      <WorkspaceProps
        data={data}
        selection={{ instance, ...(usage ? { usage } : {}) }}
      />
    );
  // The fields wait for the detail, so they never move from name order.
  if (target && (target.kind === "component" || ownProps(target)))
    return delivery.status === "ready" ? (
      controls
    ) : (
      // A replaced catalogue brings new details, so the fields keep waiting
      // for them.
      <PropsStatus
        onRetry={delivery.status === "failed" ? delivery.retry : undefined}
        status={delivery.status === "failed" ? "failed" : "loading"}
        wording={{
          failed: CONTROLS_COPY.loadFailed,
          loading: CONTROLS_COPY.loading,
          retry: CONTROLS_COPY.retry,
        }}
      />
    );
  return <WorkspaceProps data={data} selection={usage ? { usage } : {}} />;
}

/** A screen shows its own props when it has controls, saved props, or slots. */
function ownProps(target: ControlTarget): boolean {
  return (
    Object.keys(target.controls).length > 0 ||
    Object.keys(decodeProps(target.props)).length > 0 ||
    target.suppliedSlots.length > 0
  );
}

/** Read-only prop details used for inspected instances and undeclared fields. */
export function WorkspaceProps({
  data,
  selection,
}: {
  data: WorkspaceData;
  selection: WorkspaceInspectorSelection;
}) {
  const props = selection.instance?.props ?? selection.props;
  if (!props)
    return (
      <PropsMessage pending={data.viewUsagePending}>
        {emptyProps(data, selection.usage)}
      </PropsMessage>
    );
  const instance = selection.instance;
  const component = instance
    ? data.components.find((item) => item.path === instance.componentId)
    : undefined;
  const slots = instance
    ? selection.usage?.slots
        .filter((slot) => slot.instanceKey === instance.key)
        .map(
          (slot) =>
            `${slot.name} · ${
              slot.owner.kind === "entry"
                ? "Supplied by this page"
                : "Supplied by a parent component"
            }`,
        )
    : selection.slots;
  const values = decodeProps(props);
  return (
    <PropsPanel
      instance={
        instance
          ? {
              ...(component ? { href: viewHref(component.path) } : {}),
              id: instance.id,
              title: component?.title ?? instance.componentId,
            }
          : undefined
      }
      slots={slots}
      values={propValues(Object.keys(values), values)}
    />
  );
}
