/** Props inspector surface: the shown entry's fields, or its saved props. */

import { decodeProps, encodeProps } from "../components/codec.js";

import { ComponentControlFields } from "./component_control_fields.js";
import { CONTROLS_COPY } from "./component_controls_copy.js";
import type {
  ComponentEditorState,
  ControlsMode,
  ControlsNotice,
} from "./component_controls_state.js";
import {
  controlEntries,
  type ControlDraftField,
  type ControlTarget,
} from "./control_values.js";
import type { WorkspaceData } from "./workspace_data.js";
import { propText, WorkspaceProps } from "./workspace_props.js";

/** The notice of each mode that shows the saved props without fields. */
const SAVED_NOTICES: Partial<Record<ControlsMode, string>> = {
  comparison: CONTROLS_COPY.comparison,
  published: CONTROLS_COPY.published,
  removed: CONTROLS_COPY.removed,
  "read-only": CONTROLS_COPY.readonlyProps,
};

/** Render the fields with their state, or the saved props with the reason. */
export function ComponentControlsPanel({
  data,
  mode,
  onChange,
  onCurrent,
  onReset,
  onRetry,
  onStart,
  state,
  target,
}: {
  data: WorkspaceData;
  mode: ControlsMode;
  onChange(key: string, field: ControlDraftField, immediate: boolean): void;
  onCurrent(): void;
  onReset(): void;
  onRetry(): void;
  /** Load the live descriptor again after editing could not start. */
  onStart?: (() => void) | undefined;
  state: ComponentEditorState;
  target: ControlTarget;
}) {
  if (mode === "no-props")
    return <p className="mbk-empty-copy">{CONTROLS_COPY.noProps}</p>;
  const savedNotice = SAVED_NOTICES[mode];
  if (savedNotice)
    return (
      <section className="mbk-component-controls">
        <div className="mbk-controls-heading">
          <div>
            <h3>{CONTROLS_COPY.readonlyHeading}</h3>
            <p>{target.title}</p>
          </div>
        </div>
        <p className="mbk-controls-notice">{savedNotice}</p>
        {mode === "comparison" ? (
          <button className="mbk-text-button" onClick={onCurrent} type="button">
            {CONTROLS_COPY.switchToCurrent}
          </button>
        ) : null}
        <SavedPropValues target={target} />
      </section>
    );
  const preparing = mode === "preparing" || mode === "preparing-failed";
  const values = decodeProps(state.props);
  const uncontrolled = Object.fromEntries(
    Object.entries(values).filter(
      ([name]) => !Object.hasOwn(target.controls, name),
    ),
  );
  return (
    <section className="mbk-component-controls">
      <div className="mbk-controls-heading">
        <div>
          <h3>{CONTROLS_COPY.heading}</h3>
          <p>
            {target.title}
            {state.dirty ? (
              <>
                {/* The space keeps the title and the badge two words. */}{" "}
                <span className="mbk-controls-edited">
                  {CONTROLS_COPY.edited}
                </span>
              </>
            ) : (
              ` · ${CONTROLS_COPY.saved}`
            )}
          </p>
        </div>
        <button
          className="mbk-controls-reset"
          disabled={!state.dirty}
          onClick={onReset}
          type="button"
        >
          {CONTROLS_COPY.reset(target.title)}
        </button>
      </div>
      <ControlsAlert notice={state.notice} onRetry={onRetry} />
      <p className="mbk-controls-restored" role="status">
        {state.notice === "restored" ? CONTROLS_COPY.restored : null}
      </p>
      {mode === "preparing" ? (
        <p className="mbk-controls-notice" role="status">
          {CONTROLS_COPY.preparing}
        </p>
      ) : null}
      {mode === "preparing-failed" ? (
        <p className="mbk-control-alert" role="alert">
          {CONTROLS_COPY.preparingFailed}{" "}
          <button className="mbk-text-button" onClick={onStart} type="button">
            {CONTROLS_COPY.retry}
          </button>
        </p>
      ) : null}
      <fieldset className="mbk-control-fieldset" disabled={preparing}>
        <ComponentControlFields
          disabled={preparing}
          draft={state.draft}
          errors={state.errors}
          onChange={onChange}
          target={target}
        />
      </fieldset>
      {Object.keys(uncontrolled).length || target.suppliedSlots.length ? (
        <WorkspaceProps
          data={data}
          selection={{
            props: encodeProps(uncontrolled),
            slots: target.suppliedSlots,
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * The preview's status region: present while nothing renders, so a render
 * in flight is announced when its text appears.
 */
export function PreviewStatus({ pending }: { pending: boolean }) {
  return (
    <p className="mbk-preview-status" role="status">
      {pending ? (
        <>
          <span aria-hidden="true" className="mbk-pending-dot" />
          {CONTROLS_COPY.updating}
        </>
      ) : null}
    </p>
  );
}

/** One alert per failed edit: what failed, and one action when one exists. */
function ControlsAlert({
  notice,
  onRetry,
}: {
  notice: ControlsNotice | undefined;
  onRetry(): void;
}) {
  if (notice === "invalid" || notice === "invalid-together")
    return (
      <p className="mbk-control-alert" role="alert">
        {notice === "invalid"
          ? CONTROLS_COPY.invalid
          : CONTROLS_COPY.invalidTogether}
      </p>
    );
  if (notice !== "failed" && notice !== "expired") return null;
  const failed = notice === "failed";
  return (
    <div className="mbk-control-alert" role="alert">
      <strong>
        {failed ? CONTROLS_COPY.failedTitle : CONTROLS_COPY.expiredTitle}
      </strong>
      <p>{failed ? CONTROLS_COPY.failedBody : CONTROLS_COPY.expiredBody}</p>
      <button className="mbk-text-button" onClick={onRetry} type="button">
        {failed ? CONTROLS_COPY.retry : CONTROLS_COPY.expiredAction}
      </button>
    </div>
  );
}

/** Each control's saved value or Not set, the other saved props, and slots. */
function SavedPropValues({ target }: { target: ControlTarget }) {
  const values = decodeProps(target.props);
  const names = [
    ...new Set([
      ...controlEntries(target).map(([name]) => name),
      ...Object.keys(values),
    ]),
  ];
  return (
    <>
      {names.length ? (
        <table className="mbk-props-table" aria-label="Supplied props">
          <tbody>
            {names.map((name) => {
              const value = values[name];
              return (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>
                    <pre>
                      {value === undefined ? "Not set" : propText(value)}
                    </pre>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {target.suppliedSlots.length ? (
        <>
          <h3>Slots</h3>
          {target.suppliedSlots.map((slot) => (
            <p key={slot}>{slot}</p>
          ))}
        </>
      ) : null}
    </>
  );
}
