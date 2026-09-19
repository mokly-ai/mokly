/** Props inspector surface for declared controls and read-only values. */

import { decodeProps, encodeProps } from "../components/codec.js";

import {
  ComponentControlFields,
  type ControlDraftField,
} from "./component_control_fields.js";
import type { ComponentEditorState } from "./component_controls_state.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";
import { WorkspaceProps } from "./workspace_props.js";

/** Render controls with stable status, retry, reset, and readonly details. */
export function ComponentControlsPanel({
  component,
  data,
  disabled,
  onChange,
  onReset,
  onRetry,
  state,
  status,
  variant,
}: {
  component: Extract<WorkspaceData["entry"], { kind: "component" }> | undefined;
  data: WorkspaceData;
  disabled: boolean;
  onChange(key: string, field: ControlDraftField, immediate: boolean): void;
  onReset(): void;
  onRetry(): void;
  state: ComponentEditorState;
  status: string;
  variant?: WorkspaceVariant | undefined;
}) {
  const values = variant ? decodeProps(state.props) : {};
  const uncontrolled = component
    ? Object.fromEntries(
        Object.entries(values).filter(
          ([name]) => !Object.hasOwn(component.controls, name),
        ),
      )
    : {};
  return (
    <div className="mbk-component-controls">
      {component && variant ? (
        <ComponentControlFields
          component={component}
          disabled={disabled}
          draft={state.draft}
          errors={state.errors}
          onChange={onChange}
        />
      ) : null}
      <p className="mbk-control-error" hidden={!state.failure} role="alert">
        {state.failure}
      </p>
      <div className="mbk-control-actions">
        <p data-controls-status="" role="status">
          {status}
        </p>
        <button
          className="mbk-chip"
          hidden={!state.failure}
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
        <button
          className="mbk-chip"
          disabled={disabled || !state.dirty}
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      </div>
      {variant &&
      (Object.keys(uncontrolled).length ||
        variant.value.suppliedSlots.length) ? (
        <WorkspaceProps
          data={data}
          selection={{
            props: encodeProps(uncontrolled),
            slots: variant.value.suppliedSlots,
          }}
        />
      ) : null}
    </div>
  );
}
