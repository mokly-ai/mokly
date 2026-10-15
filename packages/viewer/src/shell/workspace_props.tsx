/** Supplied props and slots for a saved view or selected component instance. */

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
    return "Props are unavailable for this screen.";
  return "Select a component instance to see its supplied props.";
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
  const values = Object.entries(decodeProps(props));
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
      {values.length ? (
        <table className="mbk-props-table" aria-label="Supplied props">
          <tbody>
            {values.map(([name, value]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>
                  <pre>{propText(value)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No data props supplied.</p>
      )}
      {slots?.length ? (
        <>
          <h3>Slots</h3>
          {slots.map((slot) => (
            <p key={slot}>{slot}</p>
          ))}
        </>
      ) : null}
    </>
  );
}
