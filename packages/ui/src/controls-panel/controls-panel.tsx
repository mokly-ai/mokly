/**
 * The Props tab's controls: the form that edits the shown entry's props, and
 * the saved props of an entry that cannot be edited here. The host owns the
 * edit state and the wording. It names the elements that its recovery
 * actions focus through `focus`.
 */

import type { ReactNode, RefCallback } from "react";

import { TextButton } from "../text-button/text-button.js";

/** The elements of the panel that a host's recovery action can focus. */
export type ControlsFocus = "heading" | "fields" | "notice";

/** Names an element of the panel for the host's focus requests. */
export type ControlsFocusRef = (
  target: ControlsFocus,
) => RefCallback<HTMLElement>;

/**
 * An alert above the fields: a message about invalid values, or a failed or
 * expired render with its title, its body, and the action that renders again.
 */
export type ControlsAlert =
  { text: string } | { action: string; body: string; title: string };

/** The start of editing: preparing, or failed with an action that tries again. */
export type ControlsStart =
  | { status: "preparing"; text: string }
  | { action: string; status: "failed"; text: string };

/** The wording of the edit form, which the host supplies. */
export interface ControlsPanelWording {
  /** The badge of edited props, such as "Edited props". */
  edited: string;
  /** The panel's heading, such as "Edit props". */
  heading: string;
  /** The reset button, such as "Reset to Default". */
  reset: string;
  /** The note of saved props, such as "Saved props". */
  saved: string;
}

/** The panel's heading, the shown entry's title, and an action beside them. */
function ControlsHeading({
  action,
  focus,
  heading,
  title,
}: {
  action?: ReactNode;
  focus: ControlsFocusRef | undefined;
  heading: string;
  title: ReactNode;
}) {
  return (
    <div className="mbk-controls-heading">
      <div>
        <h3 ref={focus?.("heading")} tabIndex={-1}>
          {heading}
        </h3>
        <p>{title}</p>
      </div>
      {action}
    </div>
  );
}

/** One alert: what failed, and one action when one exists. */
function AlertView({
  alert,
  onRetry,
}: {
  alert: ControlsAlert;
  onRetry: (() => void) | undefined;
}) {
  if ("text" in alert)
    return (
      <p className="mbk-control-alert" role="alert">
        {alert.text}
      </p>
    );
  return (
    <div className="mbk-control-alert" role="alert">
      <strong>{alert.title}</strong>
      <p>{alert.body}</p>
      <TextButton onClick={onRetry}>{alert.action}</TextButton>
    </div>
  );
}

/**
 * The form that edits the shown entry's props: the heading with the entry's
 * title and Reset, an alert, the reset status, the start of editing, and the
 * fields, which stay disabled until editing starts. `extra` follows the
 * fields, such as props without a control.
 */
export function ControlsPanel({
  alert,
  children,
  dirty,
  extra,
  focus,
  onReset,
  onRetry,
  onStart,
  restored,
  start,
  title,
  wording,
}: {
  alert?: ControlsAlert | undefined;
  /** The fields. */
  children?: ReactNode;
  /** Whether the props differ from the saved props. */
  dirty: boolean;
  extra?: ReactNode;
  focus?: ControlsFocusRef | undefined;
  /** Receives each press of Reset. */
  onReset?: (() => void) | undefined;
  /** Receives each press of the alert's action. */
  onRetry?: (() => void) | undefined;
  /** Receives each press of the action of a failed start. */
  onStart?: (() => void) | undefined;
  /** The status after a reset, such as "Saved props restored." */
  restored?: string | undefined;
  start?: ControlsStart | undefined;
  /** The shown entry's title. */
  title: string;
  wording: ControlsPanelWording;
}) {
  return (
    <section className="mbk-component-controls">
      <ControlsHeading
        action={
          <button
            className="mbk-controls-reset"
            disabled={!dirty}
            onClick={() => onReset?.()}
            type="button"
          >
            {wording.reset}
          </button>
        }
        focus={focus}
        heading={wording.heading}
        title={
          <>
            {title}
            {dirty ? (
              <>
                {/* The space keeps the title and the badge two words. */}{" "}
                <span className="mbk-controls-edited">{wording.edited}</span>
              </>
            ) : (
              ` · ${wording.saved}`
            )}
          </>
        }
      />
      {alert ? <AlertView alert={alert} onRetry={onRetry} /> : null}
      <p className="mbk-controls-restored" role="status">
        {restored}
      </p>
      {start?.status === "preparing" ? (
        <p
          className="mbk-controls-notice"
          ref={focus?.("notice")}
          role="status"
          tabIndex={-1}
        >
          {start.text}
        </p>
      ) : null}
      {start?.status === "failed" ? (
        <p className="mbk-control-alert" role="alert">
          {start.text} <TextButton onClick={onStart}>{start.action}</TextButton>
        </p>
      ) : null}
      <fieldset
        className="mbk-control-fieldset"
        disabled={start !== undefined}
        ref={focus?.("fields")}
      >
        {children}
      </fieldset>
      {extra}
    </section>
  );
}

/**
 * The saved props of an entry that cannot be edited here, with the reason,
 * and Switch to Current when a comparison shows them. The props and the
 * slots follow.
 */
export function SavedPropsPanel({
  children,
  current,
  focus,
  heading,
  notice,
  onCurrent,
  title,
}: {
  /** The props and the slots. */
  children?: ReactNode;
  /** The label of Switch to Current. Without it, the panel has no such action. */
  current?: string | undefined;
  focus?: ControlsFocusRef | undefined;
  /** The panel's heading, such as "Saved props". */
  heading: string;
  /** Why the props cannot be edited here. */
  notice: string;
  /** Receives each press of Switch to Current. */
  onCurrent?: (() => void) | undefined;
  /** The shown entry's title. */
  title: string;
}) {
  return (
    <section className="mbk-component-controls">
      <ControlsHeading focus={focus} heading={heading} title={title} />
      <p className="mbk-controls-notice">{notice}</p>
      {current !== undefined ? (
        <TextButton onClick={onCurrent}>{current}</TextButton>
      ) : null}
      {children}
    </section>
  );
}
