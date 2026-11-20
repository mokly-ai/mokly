import { useEffect, useRef } from "react";

import type { ViewerAction } from "./bar";

/**
 * What an overlay was opened from: one of the bar's cloud actions, whichever
 * control carried it, or the stage's own Open billing control.
 */
export type OverlayOpener = ViewerAction | "stage-open-billing";

/** The slot that carries an opener now, or none while nothing carries it. */
export type CarrierLookup = (opener: OverlayOpener) => HTMLSpanElement | null;

const focusable =
  "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

function focusableInside(
  slot: HTMLSpanElement | null,
): HTMLElement | undefined {
  const target = slot?.querySelector<HTMLElement>(focusable);
  if (!target?.isConnected) return undefined;
  const style = window.getComputedStyle(target);
  const bounds = target.getBoundingClientRect();
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return undefined;
  }
  return target;
}

function focusInside(slot: HTMLSpanElement | null): HTMLElement | undefined {
  const target = focusableInside(slot);
  if (!target) return undefined;
  target.focus();
  return target.contains(document.activeElement) ? target : undefined;
}

// The stage and its controls stay mounted beneath an overlay. The opener lives
// in document scope because Back can reconstruct the route, a catalogue load
// can hand its carrier from fallback chrome to package chrome, and the bar can
// change composition, which moves the action between its own trigger and More.
let opener: { action: OverlayOpener; pathname: string } | undefined;

// A package load can temporarily remove every slot while replacing the cloud
// fallback with its ready shell. Keep the opening action long enough for a
// real catalogue read, but never long enough to take focus much later.
const restoreWindowMs = 5_000;

function here(): string {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

/** Name the action a press is opening an overlay for, on the page it is on. */
export function overlayOpening(action: OverlayOpener): void {
  opener = { action, pathname: here() };
}

/**
 * Return focus to the control that carries the opening action, once the
 * overlay is dismissed: the action's own trigger, or More while More carries
 * it. `carrier` answers from the bar's placement, so it names whichever
 * control the bar draws for the action now.
 *
 * Remember the action across a fallback/package handoff, a route
 * reconstruction or a change of the bar's composition; opening an overlay
 * itself keeps the stage mounted. Remember the page too: a reader who follows
 * a row out of an overlay has left, and focus belongs to where they arrived
 * rather than to the action they came from.
 * The restore is retried for a bounded window, because the chrome the overlay
 * is dismissed back onto may still be resolving what its controls can do — and
 * because an intention held indefinitely would eventually take focus from
 * wherever the reader had moved it.
 */
export function useOverlayFocus(
  open: string | undefined,
  carrier: CarrierLookup,
): void {
  const lookup = useRef(carrier);
  lookup.current = carrier;

  useEffect(() => {
    if (open !== undefined || opener === undefined) return;
    const pending = opener;
    const expires = performance.now() + restoreWindowMs;
    let frame = 0;
    let focused: HTMLElement | undefined;
    const cancel = () => {
      if (opener === pending) opener = undefined;
      cancelAnimationFrame(frame);
    };
    const restore = () => {
      if (opener !== pending) return;
      if (pending.pathname !== here() || performance.now() >= expires) {
        opener = undefined;
        return;
      }
      const slot = lookup.current(pending.action);
      const target = focusableInside(slot);
      const active = document.activeElement;
      if (target?.contains(active)) {
        focused = target;
        frame = requestAnimationFrame(restore);
        return;
      }
      if (focused?.isConnected && focused.contains(active)) {
        frame = requestAnimationFrame(restore);
        return;
      }
      const stillDismissing = active?.closest('[role="dialog"]') !== null;
      if (
        active !== null &&
        active !== document.body &&
        active !== document.documentElement &&
        !stillDismissing
      ) {
        opener = undefined;
        return;
      }
      if (!stillDismissing) focused = focusInside(slot) ?? focused;
      frame = requestAnimationFrame(restore);
    };
    document.addEventListener("keydown", cancel, true);
    document.addEventListener("pointerdown", cancel, true);
    frame = requestAnimationFrame(restore);
    return () => {
      document.removeEventListener("keydown", cancel, true);
      document.removeEventListener("pointerdown", cancel, true);
      cancelAnimationFrame(frame);
    };
  }, [open]);
}
