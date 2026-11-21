import type { ReactNode } from "react";

import { formError, nonRetryable } from "../api/form-error";
import type { FieldOwner } from "../api/form-error";
import type { ApiReason } from "../api/reasons";
import type { WriteState } from "../settings/write";
import { writeLabel } from "../settings/write";

import { writeFailure } from "./write-failure";

/** Slug claim refusals always belong to the address field that can recover. */
export const slugFieldOwners = {
  "slug-taken": "slug",
  "slug-reserved": "slug",
} as const satisfies Partial<Record<ApiReason, FieldOwner>>;

/** One form's reading of a failed submission. */
export interface FormFailureView {
  /** The message the named field owns, or nothing when it owns none. */
  on: (field: string) => string | undefined;
  /**
   * This control with its own refused write around it, as one node: the cause
   * immediately above it and the reference beneath. A cause the reader's own
   * text produced is on the field instead, so the control comes back carrying
   * only the disclosure; a submission that did not fail comes back in the
   * fragment's resting frame, which draws no box. The node stays the same
   * element through every refusal and retry, so the control keeps its focus.
   *
   * The control is passed in rather than the message handed out, because the
   * order is the fragment's to decide and not each pane's.
   */
  around: (control: ReactNode) => ReactNode;
  /**
   * What this control says now: its own resting label at rest, what it is
   * doing while it does it, and the way back when the request could succeed.
   *
   * A refusal the reader can answer only by editing what they typed already
   * sits on that field, so the control keeps its own label: asking them to
   * send the same text again would be asking for the same refusal.
   *
   * `back` is the way back's own words. Every control takes the shared ones;
   * an account screen names them, because the catalogue credits each of those
   * screens for everything it says and nothing else writes their labels, and
   * a card control that sends a build request takes them from
   * `viewer/request-controls.ts`, where Cancel keeps its own label.
   */
  label: (resting: string, working: string, back?: string) => string;
}

/**
 * Where a failed submission is reported. A form declares which reasons its own
 * fields own, and beside that the sentence a field draws when the shared one is
 * not this form's; everything else — a permission it lacks, a session that
 * ended, a version that moved on — is reported beside the action, because
 * marking the field the reader typed tells them their own text is wrong when it
 * is not.
 *
 * Every form reads its failures through here, so the cause, the order and the
 * label cannot drift apart one pane at a time. A `Write` is a `WriteState`, so
 * a pane hands its own write straight in.
 */
export function formFailure(
  state: WriteState,
  fields: Partial<Record<ApiReason, FieldOwner>>,
): FormFailureView {
  const failure = state.error ? formError(state.error, fields) : undefined;
  const ownedByField = Boolean(failure?.field);
  const reason = state.error?.reason;
  const answered =
    ownedByField ||
    (reason !== undefined &&
      reason !== "unrecognized" &&
      nonRetryable.has(reason));
  return {
    on: (field: string) =>
      failure?.field === field ? failure.message : undefined,
    around: (control: ReactNode) =>
      writeFailure(
        ownedByField ? undefined : failure?.message,
        state.error,
        control,
      ),
    label: (resting: string, working: string, back?: string) =>
      writeLabel({ ...state, answered }, resting, working, back),
  };
}
