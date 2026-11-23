import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { asApiError, unexpectedError } from "../api/errors";
import type { ApiError } from "../api/errors";
import { formFailure } from "../components/form-failure";
import { useLeavePage } from "../navigation/leave-page";
import type { PageTrip } from "../navigation/leave-page";

/** What one control's write is doing, and what its own control should read. */
export interface Write {
  /** Whether the write is in flight, so the pane can say so and stand still. */
  pending: boolean;
  /** Why the last attempt failed, for the pane to report with one retry. */
  error: ApiError | undefined;
  /**
   * Whether the control still has something to send. The control that sends
   * this write refuses a press at rest while it has not: `Action` reads this
   * from the write bound to it, so what the control does and what its write
   * believes cannot disagree.
   */
  sendable: boolean;
  /**
   * Whether this write is working, for what shows it rather than what decides
   * it: the control that sends it, which `Action` draws busy from this, and
   * the input a form holds still while its own write is in flight.
   *
   * The same answer as `pending`, under the name the question has where it is
   * asked. `pending` is what the write is doing, and the label and the
   * fragment read it; `working` is what a busy control and a held input read
   * — so a `disabled` never has to name `pending`, and no local alias has to
   * stand in for one, which is what `derive-disabled-from-write` reads.
   */
  working: boolean;
  /**
   * Send one write and own everything around it. The control passes a closure
   * naming exactly the fields it sends, so a control can never carry a field
   * the reader was not acting on, and a second press while the first is in
   * flight sends nothing.
   */
  run: (work: () => Promise<unknown>) => Promise<void>;
  /**
   * Hand this tab to another site as the last step of the work `run` sends,
   * such as GitHub's authorization. It leaves only while the screen that
   * started the write is shown, and that screen calls the trip off if it goes
   * before the next page loads, so a reader who followed Back or another link
   * stays where they went. A write that left is done when the page goes, so
   * it stays in flight until then: its control stays busy and a second press
   * sends nothing. A page that the browser restores from its back-forward
   * cache returns the write to rest.
   *
   * GitHub takes its purpose and API answer together, so the shown check also
   * protects the tab's flow record. Other hosted pages take their URL alone.
   */
  leave: (...trip: PageTrip) => void;
  /** Forget a refusal after the input that produced it changes. */
  clearError: () => void;
  /**
   * What this control says now: its own resting label at rest, what it is
   * doing while it does it, and the way back when it failed. A control reads
   * its own write, so a failure can never put a retry on a control that would
   * do something else.
   *
   * `back` is the way back's own words. Every control takes the shared ones;
   * an account screen names them, because the catalogue credits each of those
   * screens for everything it says and nothing else writes their labels, and
   * a card control that sends a build request takes them from
   * `viewer/request-controls.ts`, where Cancel keeps its own label. A control
   * with no fields says so here rather than building a form view over a form
   * it does not have.
   */
  label: (resting: string, working: string, back?: string) => string;
  /**
   * This control with its own refused write around it, as one node the pane
   * drops in: the cause immediately above the control, the control as the way
   * back, and the reference beneath. A control at rest comes back in the
   * fragment's resting frame, which draws no box, and the node stays the same
   * element through every refusal and retry, so the control keeps its focus.
   *
   * A control whose form owns some of its causes reads them through
   * `formFailure` instead, which puts a cause the reader's own text produced on
   * the field and everything else here.
   */
  around: (control: ReactNode) => ReactNode;
}

/** For a write the pane has nothing of its own to do after. */
export function nothingToDo(): void {}

/**
 * For a write that can always be sent: a control with no input of its own to
 * undo, like starting an authorization or withdrawing one invitation. Named
 * rather than written as `true`, so a call site that simply forgot to think
 * about it reads differently from one that did.
 */
export const alwaysSendable = true;

/** What one control's write is doing, as a label and a fragment both read it. */
export interface WriteState {
  /** Whether the write is in flight. */
  pending: boolean;
  /** Why the last attempt failed, or nothing when none has. */
  error: ApiError | undefined;
}

/** What every control's way back reads, unless its own screen names one. */
export const wayBack = "Try again";

/**
 * What a control reads while its own write is resting, working or failed.
 *
 * The way back is offered only where the same request could succeed. `answered`
 * says the reader must change a field or take a different action before the
 * request can succeed, so the control keeps its own label: pressing it again
 * would be refused again.
 */
export function writeLabel(
  state: WriteState & { answered?: boolean },
  resting: string,
  working: string,
  back: string = wayBack,
): string {
  if (state.pending) return working;
  return state.error && !state.answered ? back : resting;
}

/**
 * Whether a failure still belongs on screen.
 *
 * A failure belongs to the attempt that produced it, so when the reader undoes
 * the input the attempt was made from — puts a name back the way it was,
 * closes the confirmation they opened — there is no longer an attempt for it
 * to describe, and the notice and its way back go with it.
 */
export function failureAfterInput(
  error: ApiError | undefined,
  sendable: boolean,
): ApiError | undefined {
  return sendable ? error : undefined;
}

/**
 * How a settings pane writes. Every mutation in settings goes through here,
 * one instance per control, so every one of them shows that it is working,
 * reports what went wrong with a way to try again, and cannot be sent twice by
 * an impatient second press — which is what `settings-dialog.md` asks of a
 * pane's states, and what a bare promise chain in one control silently does
 * not do.
 *
 * One instance per control is the whole point: two controls sharing one would
 * label both with whichever failed, and the reader would press a way back that
 * belonged to the other one.
 *
 * `done` is the pane's own way of catching up afterwards, usually reloading
 * what it is showing. `sendable` is whether the control still has something to
 * send, and it is required: the control that sends the write refuses a press
 * while there is nothing to send, so a call site cannot leave the question
 * unanswered.
 *
 * A failure belongs to the attempt, so when the reader undoes the input it was
 * made from, the failure goes with it rather than standing over a control that
 * would refuse it.
 *
 * A write that ends by leaving the page, for GitHub or Stripe, is done when the
 * page goes, so it does not come back to rest when its work returns: `leave`
 * keeps it in flight until the page unloads, and `done` does not run for it.
 *
 * `failed` is a failure of the same write that another control met before
 * this one mounted, such as the account menu's Sign out. The control shows it
 * as its own, until its next attempt.
 */
export function useWrite(
  done: () => void,
  sendable: boolean,
  failed?: ApiError,
): Write {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | undefined>(failed);
  const inFlight = useRef(false);
  // Whether the attempt in flight handed the tab to another site.
  const leaving = useRef(false);
  const finish = useRef(done);
  finish.current = done;
  // The browser brought the page back from its back-forward cache, so the
  // page never went: the write is over, and its control is at rest again.
  const leavePage = useLeavePage(() => {
    leaving.current = false;
    inFlight.current = false;
    setPending(false);
  });

  const run = useCallback(async (work: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    let wrote = false;
    try {
      await work();
      wrote = true;
    } catch (caught) {
      // An unrecognised failure is still a failure: reporting nothing would
      // leave the control looking as though nothing had happened.
      setError(asApiError(caught) ?? unexpectedError());
    } finally {
      // A write that left the page is done when the page goes, so it stays in
      // flight, and its control busy, until then.
      if (!leaving.current) {
        inFlight.current = false;
        setPending(false);
      }
    }
    // Outside the attempt, so a pane catching up cannot be reported as a
    // write that failed.
    if (wrote && !leaving.current) finish.current();
  }, []);
  const leave = useCallback(
    (...trip: PageTrip) => {
      if (leavePage(...trip)) leaving.current = true;
    },
    [leavePage],
  );
  const clearError = useCallback(() => setError(undefined), []);

  useLayoutEffect(() => {
    setError((current) => failureAfterInput(current, sendable));
  }, [sendable]);

  const label = useCallback(
    (resting: string, working: string, back?: string) =>
      formFailure({ pending, error }, {}).label(resting, working, back),
    [pending, error],
  );
  // A control with no fields of its own owns every cause it can be refused
  // with, so the form's field map is empty and the whole cause is the message.
  const around = useCallback(
    (control: ReactNode) => formFailure({ pending, error }, {}).around(control),
    [pending, error],
  );
  return useMemo(
    () => ({
      pending,
      error,
      sendable,
      working: pending,
      run,
      leave,
      clearError,
      label,
      around,
    }),
    [pending, error, sendable, run, leave, clearError, label, around],
  );
}
