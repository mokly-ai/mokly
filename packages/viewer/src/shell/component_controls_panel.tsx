/**
 * The Props inspector surface: the shown entry's fields, or its saved props.
 * These containers map the controls state and the props that the preview
 * shows to the notices, the alerts, and the wording of
 * `component_controls_copy.ts`. `@mokly/ui/controls-panel` renders the
 * panels, `@mokly/ui/props-panel` the saved props, and
 * `@mokly/ui/edit-status` the status of an edit's render.
 */

import type { RefCallback } from "react";

import {
  ControlsPanel,
  SavedPropsPanel,
  type ControlsAlert,
  type ControlsFocus,
} from "@mokly/ui/controls-panel";
import { EditStatus as EditStatusView } from "@mokly/ui/edit-status";
import { PropSlots, PropValues, PropsMessage } from "@mokly/ui/props-panel";

import { decodeProps, encodeProps } from "../components/codec.js";

import { ComponentControlFields } from "./component_control_fields.js";
import { CONTROLS_COPY } from "./component_controls_copy.js";
import type {
  ComponentEditorState,
  ControlsMode,
  ControlsNotice,
  ShownProps,
} from "./component_controls_state.js";
import {
  controlEntries,
  type ControlDraftField,
  type ControlTarget,
} from "./control_values.js";
import { propValues, UncontrolledProps } from "./workspace_props.js";

export type { ControlsFocus } from "@mokly/ui/controls-panel";

/** The notice of each mode that shows the saved props without fields. */
const SAVED_NOTICES: Partial<Record<ControlsMode, string>> = {
  published: CONTROLS_COPY.published,
  removed: CONTROLS_COPY.removed,
  "read-only": CONTROLS_COPY.readonlyProps,
};

/**
 * One alert per failed edit: what failed, and one action when one exists. A
 * failed render and an invalid value name the props that the preview shows.
 */
function controlsAlert(
  notice: ControlsNotice | undefined,
  preview: ShownProps,
): ControlsAlert | undefined {
  const saved = preview === "saved";
  if (notice === "invalid")
    return { text: saved ? CONTROLS_COPY.invalidSaved : CONTROLS_COPY.invalid };
  if (notice === "invalid-together")
    return { text: CONTROLS_COPY.invalidTogether };
  if (notice === "failed")
    return {
      action: CONTROLS_COPY.retry,
      body: saved ? CONTROLS_COPY.failedSavedBody : CONTROLS_COPY.failedBody,
      title: CONTROLS_COPY.failedTitle,
    };
  if (notice === "expired")
    return {
      action: CONTROLS_COPY.expiredAction,
      body: CONTROLS_COPY.expiredBody,
      title: CONTROLS_COPY.expiredTitle,
    };
  return undefined;
}

/** Render the fields with their state, or the saved props with the reason. */
export function ComponentControlsPanel({
  focus,
  mode,
  onChange,
  onReset,
  onRetry,
  onStart,
  preview,
  state,
  target,
}: {
  /** Name an element that a recovery action can focus. */
  focus?: (name: ControlsFocus) => RefCallback<HTMLElement>;
  mode: ControlsMode;
  onChange(key: string, field: ControlDraftField, immediate: boolean): void;
  onReset(): void;
  onRetry(): void;
  /** Load the live descriptor again after editing could not start. */
  onStart?: (() => void) | undefined;
  /** The props that the entry's shown frames show, which the alerts name. */
  preview: ShownProps;
  state: ComponentEditorState;
  target: ControlTarget;
}) {
  if (mode === "no-props")
    return <PropsMessage>{CONTROLS_COPY.noProps}</PropsMessage>;
  const savedNotice = SAVED_NOTICES[mode];
  if (savedNotice) {
    const values = decodeProps(target.props);
    const names = new Set([
      ...controlEntries(target).map(([name]) => name),
      ...Object.keys(values),
    ]);
    return (
      <SavedPropsPanel
        focus={focus}
        heading={CONTROLS_COPY.readonlyHeading}
        notice={savedNotice}
        title={target.title}
      >
        {names.size ? (
          <PropValues values={propValues([...names], values)} />
        ) : null}
        <PropSlots slots={target.suppliedSlots} />
      </SavedPropsPanel>
    );
  }
  const preparing = mode === "preparing" || mode === "preparing-failed";
  const uncontrolled = Object.fromEntries(
    Object.entries(decodeProps(state.props)).filter(
      ([name]) => !Object.hasOwn(target.controls, name),
    ),
  );
  return (
    <ControlsPanel
      alert={controlsAlert(state.notice, preview)}
      dirty={state.dirty}
      extra={
        Object.keys(uncontrolled).length || target.suppliedSlots.length ? (
          <UncontrolledProps
            props={encodeProps(uncontrolled)}
            slots={target.suppliedSlots}
          />
        ) : null
      }
      focus={focus}
      onReset={onReset}
      onRetry={onRetry}
      onStart={onStart}
      restored={
        state.notice === "restored" ? CONTROLS_COPY.restored : undefined
      }
      start={
        mode === "preparing"
          ? { status: "preparing", text: CONTROLS_COPY.preparing }
          : mode === "preparing-failed"
            ? {
                action: CONTROLS_COPY.retry,
                status: "failed",
                text: CONTROLS_COPY.preparingFailed,
              }
            : undefined
      }
      title={target.title}
      wording={{
        edited: CONTROLS_COPY.edited,
        heading: CONTROLS_COPY.heading,
        reset: CONTROLS_COPY.reset(target.title),
        saved: CONTROLS_COPY.saved,
      }}
    >
      <ComponentControlFields
        disabled={preparing}
        draft={state.draft}
        errors={state.errors}
        onChange={onChange}
        target={target}
      />
    </ControlsPanel>
  );
}

/**
 * The status region of an edit's render: present while nothing renders, so
 * a render in flight is announced when its text appears. It stays outside
 * the busy preview, whose announcements wait until the preview is ready.
 */
export function EditStatus({ pending }: { pending: boolean }) {
  return (
    <EditStatusView status={pending ? CONTROLS_COPY.updating : undefined} />
  );
}
