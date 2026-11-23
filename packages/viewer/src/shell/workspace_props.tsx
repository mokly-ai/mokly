/**
 * Inspect's Props section and the read-only props of an edit form. The
 * section shows the props of the entry that Props edits: a screen's own
 * props, or a variant set's selected frame's variant, which a reader
 * chooses first. These containers decode the props, word their values, and
 * choose the line that says why the section has none. `@mokly/ui/props-panel`
 * renders them.
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

import { CONTROLS_COPY } from "./component_controls_copy.js";
import { controlEntries, type ControlTarget } from "./control_values.js";
import type { DetailDelivery } from "./data_requests.js";
import type { RetryFocus } from "./retry_focus.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WAITING_REASON } from "./workspace_inspection_runtime.js";

/** What a variant set's Props say while no frame is selected. */
export const CHOOSE_VARIANT = "Choose a variant to edit its props.";

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

/** A screen shows its own props when it has controls, saved props, or slots. */
function ownProps(target: ControlTarget): boolean {
  return (
    Object.keys(target.controls).length > 0 ||
    Object.keys(decodeProps(target.props)).length > 0 ||
    target.suppliedSlots.length > 0
  );
}

/** Whether Props shows the edit form or the saved props of `target`. */
export function editsProps(target: ControlTarget | undefined): boolean {
  return target !== undefined && (target.kind === "component" || ownProps(target));
}

/** The number of fields of the form that Props shows, where it has fields. */
export function propsFieldCount(
  target: ControlTarget | undefined,
): number | undefined {
  if (!target || !editsProps(target)) return undefined;
  return controlEntries(target).length || undefined;
}

/**
 * The Props section: the entry's own fields or saved props, once the route's
 * details arrive, or why the section has none to show.
 */
export function WorkspacePropsSection({
  choose,
  controls,
  data,
  delivery,
  focus,
  target,
  unavailable,
}: {
  /** Whether Props waits for the choice of a variant set's frame. */
  choose: boolean;
  /** The editable props, whose heading ends the recovery of `focus`. */
  controls: ReactNode;
  data: WorkspaceData;
  /** The route's details. The routed entry's own detail carries the fields' order. */
  delivery: DetailDelivery;
  /** The focus of Try again, which moves to the loading status first. */
  focus: RetryFocus;
  target: ControlTarget | undefined;
  /**
   * Whether the shown view of a screen has no usage record, as a view
   * without inspection metadata has, so its props are unknown.
   */
  unavailable: boolean;
}) {
  // The fields wait for the detail, so they never move from name order.
  // After Try again, focus moves to the loading status, then to the panel.
  if (editsProps(target))
    return delivery.status === "ready" ? (
      controls
    ) : (
      // A replaced catalogue brings new details, so the fields keep waiting
      // for them.
      <PropsStatus
        focusRef={focus.status}
        onRetry={
          delivery.status === "failed" ? focus.retry(delivery.retry) : undefined
        }
        status={delivery.status === "failed" ? "failed" : "loading"}
        wording={{
          failed: CONTROLS_COPY.loadFailed,
          loading: CONTROLS_COPY.loading,
          retry: CONTROLS_COPY.retry,
        }}
      />
    );
  if (choose) return <PropsMessage>{CHOOSE_VARIANT}</PropsMessage>;
  return (
    <PropsMessage pending={data.viewUsagePending}>
      {data.viewUsagePending
        ? WAITING_REASON
        : unavailable
          ? CONTROLS_COPY.propsUnavailable
          : CONTROLS_COPY.noProps}
    </PropsMessage>
  );
}

/** The props of an edit form that no control declares, with its slots. */
export function UncontrolledProps({
  props,
  slots,
}: {
  props: ComponentWireProps;
  slots: readonly string[];
}) {
  const values = decodeProps(props);
  return (
    <PropsPanel
      slots={slots}
      values={propValues(Object.keys(values), values)}
    />
  );
}
