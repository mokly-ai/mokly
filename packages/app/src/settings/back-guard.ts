import { useEffect, useLayoutEffect, useRef } from "react";

import { gateTraversal } from "../navigation/traversal";

import type { Drafts } from "./drafts";
import { gestureHome, guardSurface, judgeGesture } from "./gestures";
import type { SurfaceGuard } from "./gestures";

/** What a surface tells the guard about the drafts it is holding. */
export interface BackGuardSurface {
  /** Whether the surface is on screen; only one that is answers a gesture. */
  armed: boolean;
  /** The drafts the surface's panes are holding. */
  drafts: Drafts;
  /** Whether the reader is already being asked what a gesture should mean. */
  isAsking: () => boolean;
  /** Ask the reader what the gesture should mean. */
  onBlocked: () => void;
}

/** What the surface can do once the reader has answered. */
export interface BackGuardHandle {
  /** Let the gesture the guard held back finish, unchanged. */
  release: () => void;
}

/** Whether this surface has anything a gesture would take from the reader. */
function holding(surface: BackGuardSurface): boolean {
  return surface.isAsking() || surface.drafts.isDirty();
}

/**
 * A draft has to survive every way out of the surface holding it, and those
 * ways fall into two kinds.
 *
 * Exits the application can intercept are the ones that stay inside this
 * document: the browser's back and forward gestures over history entries the
 * running application created. Those reach `popstate`, and the guard answers
 * them with the product's own confirmation — it stops the router, puts the
 * reader back where the gesture started, and asks.
 *
 * Exits only the browser can intercept are the ones that leave this document:
 * back to a page loaded before it, a reload, a typed address, a closed tab.
 * No event in the page can stop those, so the browser's own prompt has to
 * cover them, which is what `beforeunload` is for. It is in place for exactly
 * as long as a draft exists and gone the moment there is none, so a reader
 * with nothing to lose is never asked.
 *
 * Both halves are needed: a surface opened from a bookmark or a shared link is
 * the first document in its own history, and every way out of it is the second
 * kind. The stack stays exactly as deep as the reader's own steps made it:
 * this dialog and the viewer's panels each push one entry when they open and
 * undo it when they close, and everything else — a pane switch, a corrected
 * value, a move between panels — replaces. `docs/protocol/cloud/web-product-shell.md` holds
 * the table.
 *
 * The guard is in place for exactly as long as the surface is on screen. An
 * exit the reader chose is carried by the gesture it completes, not by taking
 * the guard down, so an exit that turns out to leave the surface still showing
 * — one settings address behind another — cannot leave the next draft
 * undefended.
 */
export function useBackGuard(surface: BackGuardSurface): BackGuardHandle {
  const latest = useRef(surface);
  const here = useRef("");
  const guard = useRef<SurfaceGuard | undefined>(undefined);
  guard.current ??= guardSurface({
    home: () => here.current,
    holds: () => holding(latest.current),
    ask: () => latest.current.onBlocked(),
  });

  useLayoutEffect(() => {
    latest.current = surface;
    // Where the surface is displayed, which is where a held gesture is undone
    // to. It follows the address only while there is nothing to hold: once the
    // reader has something to lose, the address may move under a gesture this
    // guard is about to undo, and following it there would lose the way back.
    if (typeof window !== "undefined" && !holding(surface)) {
      here.current = window.location.href;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    guard.current?.showing(surface.armed);
    return () => guard.current?.showing(false);
  }, [surface.armed]);

  useUnloadPrompt(surface.armed, surface.drafts);

  const handle = useRef<BackGuardHandle>({
    release: () => {
      guard.current?.release();
      if (typeof window !== "undefined") window.history.back();
    },
  });
  return handle.current;
}

function holdUnload(event: BeforeUnloadEvent): string {
  event.preventDefault();
  // Browsers show their own wording; the returned value is only the signal.
  event.returnValue = "";
  return "";
}

/**
 * The browser's prompt, in place for exactly as long as a draft exists. It is
 * assigned rather than added as a listener so the page can be asked whether a
 * guard is present, which is the only part of a native prompt a test can see.
 */
function useUnloadPrompt(armed: boolean, drafts: Drafts): void {
  useEffect(() => {
    if (!armed || typeof window === "undefined") return;
    const apply = () => {
      window.onbeforeunload = drafts.isDirty() ? holdUnload : null;
    };
    apply();
    const stop = drafts.watch(apply);
    return () => {
      stop();
      window.onbeforeunload = null;
    };
  }, [armed, drafts]);
}

// A browser is free to fold two gestures made in one breath into a single
// traversal, and the move back that answers them can be folded away with them.
// The surface's own address is the only thing worth trusting, so the restore
// keeps asking for one more step forward until the reader is at it again. Each
// step that lands somewhere else raises a gesture of its own, which is judged
// and corrected the same way, so the correction renews itself for as long as
// the surface is still holding something; it stops as soon as the address is
// the surface's own, or as soon as there is nothing left to hold.
const settleDelayMs = 60;
const settleAttempts = 8;

function restore(attemptsLeft: number) {
  const home = gestureHome();
  if (home === undefined || window.location.href === home) return;
  window.history.forward();
  if (attemptsLeft <= 0) return;
  window.setTimeout(() => restore(attemptsLeft - 1), settleDelayMs);
}

/**
 * The guard is the first gate of the one listener that runs before the
 * router, so it judges every gesture before the router can reset the screen
 * under the reader.
 */
function onPopState(): boolean {
  const verdict = judgeGesture(window.location.href);
  if (!verdict.stop) return false;
  if (verdict.restore) restore(settleAttempts);
  return true;
}

gateTraversal(onPopState);
