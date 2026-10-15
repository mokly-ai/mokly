/** Props inspector surface for declared controls and read-only values. */

import { decodeProps, encodeProps } from "../components/codec.js";

import { ComponentControlFields } from "./component_control_fields.js";
import type { ComponentEditorState } from "./component_controls_state.js";
import type { ControlDraftField, ControlTarget } from "./control_values.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WorkspaceProps } from "./workspace_props.js";

/** Render controls with stable status, retry, reset, and readonly details. */
export function ComponentControlsPanel({
  data,
  disabled,
  onChange,
  onReset,
  onRetry,
  state,
  status,
  target,
}: {
  data: WorkspaceData;
  disabled: boolean;
  onChange(key: string, field: ControlDraftField, immediate: boolean): void;
  onReset(): void;
  onRetry(): void;
  state: ComponentEditorState;
  status: string;
  target: ControlTarget | undefined;
}) {
  const values = target ? decodeProps(state.props) : {};
  const uncontrolled = target
    ? Object.fromEntries(
        Object.entries(values).filter(
          ([name]) => !Object.hasOwn(target.controls, name),
        ),
      )
    : {};
  return (
    <div className="mbk-component-controls">
      {target ? (
        <ComponentControlFields
          disabled={disabled}
          draft={state.draft}
          errors={state.errors}
          onChange={onChange}
          target={target}
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
      {target &&
      (Object.keys(uncontrolled).length || target.suppliedSlots.length) ? (
        <WorkspaceProps
          data={data}
          selection={{
            props: encodeProps(uncontrolled),
            slots: target.suppliedSlots,
          }}
        />
      ) : null}
    </div>
  );
}
