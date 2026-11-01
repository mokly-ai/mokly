/**
 * The Props tab's controls: the form that edits the shown entry's props, and
 * the saved props of an entry that cannot be edited here. The host owns the
 * edit state and the wording. It names the elements that its recovery
 * actions focus through `focus`. A static depiction that runs no script gives
 * an action an address, which draws it as a link.
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
    <div className="mbk-controls-heading mbk-reset">
      <div className="mbk-reset">
        <h3 className="mbk-reset" ref={focus?.("heading")} tabIndex={-1}>
          {heading}
        </h3>
        <p className="mbk-reset">{title}</p>
      </div>
      {action}
    </div>
  );
}

/** One alert: what failed, and one action when one exists. */
function AlertView({
  alert,
  onRetry,
  retryHref,
}: {
  alert: ControlsAlert;
  onRetry: (() => void) | undefined;
  retryHref: string | undefined;
}) {
  if ("text" in alert)
    return (
      <p className="mbk-control-alert mbk-reset" role="alert">
        {alert.text}
      </p>
    );
  return (
    <div className="mbk-control-alert mbk-reset" role="alert">
      <strong className="mbk-reset">{alert.title}</strong>
      <p className="mbk-reset">{alert.body}</p>
      <TextButton href={retryHref} onClick={onRetry}>
        {alert.action}
      </TextButton>
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
  resetHref,
  restored,
  retryHref,
  start,
  startHref,
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
  /**
   * The address that Reset opens in a static depiction, such as a document
   * that shows the saved props restored. While the props differ from the
   * saved props, Reset is then a link.
   */
  resetHref?: string | undefined;
  /** The status after a reset, such as "Saved props restored." */
  restored?: string | undefined;
  /** The address that the alert's action opens in a static depiction. */
  retryHref?: string | undefined;
  start?: ControlsStart | undefined;
  /** The address that the action of a failed start opens in a static depiction. */
  startHref?: string | undefined;
  /** The shown entry's title. */
  title: string;
  wording: ControlsPanelWording;
}) {
  return (
    <section className="mbk-component-controls mbk-reset">
      <ControlsHeading
        action={
          dirty && resetHref !== undefined ? (
            <a className="mbk-controls-reset mbk-reset" href={resetHref}>
              {wording.reset}
            </a>
          ) : (
            <button
              className="mbk-controls-reset mbk-reset"
              disabled={!dirty}
              onClick={() => onReset?.()}
              type="button"
            >
              {wording.reset}
            </button>
          )
        }
        focus={focus}
        heading={wording.heading}
        title={
          <>
            {title}
            {dirty ? (
              <>
                {/* The space keeps the title and the badge two words. */}{" "}
                <span className="mbk-controls-edited mbk-reset">
                  {wording.edited}
                </span>
              </>
            ) : (
              ` · ${wording.saved}`
            )}
          </>
        }
      />
      {alert ? (
        <AlertView alert={alert} onRetry={onRetry} retryHref={retryHref} />
      ) : null}
      <p className="mbk-controls-restored mbk-reset" role="status">
        {restored}
      </p>
      {start?.status === "preparing" ? (
        <p
          className="mbk-controls-notice mbk-reset"
          ref={focus?.("notice")}
          role="status"
          tabIndex={-1}
        >
          {start.text}
        </p>
      ) : null}
      {start?.status === "failed" ? (
        <p className="mbk-control-alert mbk-reset" role="alert">
          {start.text}{" "}
          <TextButton href={startHref} onClick={onStart}>
            {start.action}
          </TextButton>
        </p>
      ) : null}
      <fieldset
        className="mbk-control-fieldset mbk-reset"
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
  currentHref,
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
  /** The address that Switch to Current opens in a static depiction. */
  currentHref?: string | undefined;
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
    <section className="mbk-component-controls mbk-reset">
      <ControlsHeading focus={focus} heading={heading} title={title} />
      <p className="mbk-controls-notice mbk-reset">{notice}</p>
      {current !== undefined ? (
        <TextButton href={currentHref} onClick={onCurrent}>
          {current}
        </TextButton>
      ) : null}
      {children}
    </section>
  );
}
