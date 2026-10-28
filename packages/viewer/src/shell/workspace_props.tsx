/** Supplied props and slots for a saved view or selected component instance. */

import type { ReactNode } from "react";

import { decodeProps } from "../components/codec.js";
import type {
  ComponentInstanceRecord,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type {
  ComponentWireProps,
  PropValue,
} from "../components/prop_types.js";
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
export function propText(value: PropValue): string {
  if (value === null) return "null";
  if (typeof value === "number")
    return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(propText).join(", ")}]`;
  return `{${Object.entries(value)
    .map(([key, item]) => `${JSON.stringify(key)}: ${propText(item)}`)
    .join(", ")}}`;
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

/** The one list of supplied props: each name and its value, or Not set. */
export function PropValues({
  names,
  values,
}: {
  names: readonly string[];
  values: Readonly<Record<string, PropValue>>;
}) {
  return (
    <dl aria-label="Supplied props" className="mbk-props">
      {names.map((name) => {
        const value = values[name];
        return (
          <div key={name}>
            <dt>{name}</dt>
            <dd>
              <code>
                {value === undefined ? CONTROLS_COPY.notSet : propText(value)}
              </code>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Supplied slots under their own heading, below the props. */
export function PropSlots({ slots }: { slots: readonly string[] | undefined }) {
  return slots?.length ? (
    <>
      <h4>Slots</h4>
      {slots.map((slot) => (
        <p key={slot}>{slot}</p>
      ))}
    </>
  ) : null;
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
  /** The route's details, which together carry the fields' order. */
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
      <PropsDelivery delivery={delivery} />
    );
  return <WorkspaceProps data={data} selection={usage ? { usage } : {}} />;
}

/**
 * Props while the route's details load, or after one load fails. A
 * replaced catalogue brings new details, so the fields keep waiting for them.
 */
function PropsDelivery({
  delivery,
}: {
  delivery: Exclude<DetailDelivery, { status: "ready" }>;
}) {
  return (
    <section aria-label="Props status" data-props-section="status">
      {delivery.status === "failed" ? (
        <>
          <p role="alert">{CONTROLS_COPY.loadFailed}</p>
          <button
            className="mbk-text-button"
            onClick={delivery.retry}
            type="button"
          >
            {CONTROLS_COPY.retry}
          </button>
        </>
      ) : (
        <p role="status">{CONTROLS_COPY.loading}</p>
      )}
    </section>
  );
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
      <p
        className={data.viewUsagePending ? undefined : "mbk-empty-copy"}
        role={data.viewUsagePending ? "status" : undefined}
      >
        {emptyProps(data, selection.usage)}
      </p>
    );
  const component = selection.instance
    ? data.components.find(
        (item) => item.path === selection.instance?.componentId,
      )
    : undefined;
  const slots = selection.instance
    ? selection.usage?.slots
        .filter((slot) => slot.instanceKey === selection.instance?.key)
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
    <>
      {selection.instance ? (
        <>
          <h3>
            {component?.title ?? selection.instance.componentId}
            {` · ${selection.instance.id}`}
          </h3>
          {component ? (
            <a href={viewHref(component.path)}>Open component</a>
          ) : null}
        </>
      ) : null}
      {Object.keys(values).length ? (
        <PropValues names={Object.keys(values)} values={values} />
      ) : (
        <p>No data props supplied.</p>
      )}
      <PropSlots slots={slots} />
    </>
  );
}
