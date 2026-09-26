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
      <p role={data.viewUsagePending ? "status" : undefined}>
        {data.viewUsagePending
          ? WAITING_REASON
          : "Select a component instance to see its supplied props."}
      </p>
    );
  const component = selection.instance
    ? data.components.find(
        (item) => item.id === selection.instance?.componentId,
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
            <a href={`/view/${encodeRoute(component.route)}`}>Open component</a>
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

function encodeRoute(route: string): string {
  return route.split("/").map(encodeURIComponent).join("/");
}
