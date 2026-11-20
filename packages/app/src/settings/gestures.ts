/** What one surface can tell the registry about a back gesture. */
export interface GestureGuard {
  /** The address the surface is displayed at, as the browser records it. */
  home: () => string;
  /** Whether a gesture must be answered before the surface may be left. */
  holds: () => boolean;
  /** Ask the reader what the gesture should mean. Answering more than once is
   * the same question, so this may be called again while it is on screen. */
  ask: () => void;
}

/** What the browser should do with a gesture the registry has considered. */
export interface GestureVerdict {
  /** Whether the router must not act on this gesture. */
  stop: boolean;
  /** Whether the reader should be put back where the gesture started. */
  restore: boolean;
}

/**
 * A surface's presence in the registry. Its lifetime belongs to the surface
 * being on screen and nothing else: there is no way to stand it down early,
 * because an exit that leaves the surface takes the registration with it and
 * an exit that does not leave the surface has no business disarming it.
 */
export interface SurfaceGuard {
  /** Say whether the surface is on screen. Idempotent. */
  showing: (armed: boolean) => void;
  /** Let the next gesture through, once, to complete one the reader chose. */
  release: () => void;
}

const armed: GestureGuard[] = [];
// The surfaces that have let one gesture through, keyed by the guard that did
// so. A token belongs to the surface that issued it, so a surface that leaves
// the screen takes any unspent token with it rather than leaving one lying in
// wait for an unrelated gesture.
const passing = new WeakSet<GestureGuard>();

/**
 * Register a surface's answer to back gestures. The innermost surface answers,
 * so a surface that closes cannot answer for one that is still open.
 */
export function guardSurface(guard: GestureGuard): SurfaceGuard {
  return {
    // Whether this surface is registered is read from the stack rather than
    // remembered beside it: a surface below this one leaving shifts every
    // index above it, and an index that disagreed with the stack would leave
    // a surface that is off the screen still answering for it.
    showing: (on) => {
      const at = armed.lastIndexOf(guard);
      if (on === at > -1) return;
      if (on) {
        armed.push(guard);
        return;
      }
      armed.splice(at, 1);
      passing.delete(guard);
    },
    release: () => {
      passing.add(guard);
    },
  };
}

/**
 * What to do with a gesture that has landed at `at`.
 *
 * The surface's own address is the whole bookkeeping: a gesture that has moved
 * the reader away from it is one the surface must answer, and the move back
 * that answers it lands on that address again and is let through, so the
 * router keeps its own record in step. Pressing back twice before the first
 * answer arrives is still one question — every gesture is held while the
 * reader is being asked — and each press is undone by its own move back, so
 * the address and the screen agree once the reader has answered.
 */
export function judgeGesture(at: string): GestureVerdict {
  const guard = armed[armed.length - 1];
  if (guard && passing.has(guard)) {
    passing.delete(guard);
    return { stop: false, restore: false };
  }
  if (!guard || !guard.holds()) return { stop: false, restore: false };
  if (at === guard.home()) return { stop: false, restore: false };
  guard.ask();
  return { stop: true, restore: true };
}

/**
 * The address the surface answering gestures is displayed at, while it is
 * still holding them back. A restore that has not arrived there yet has more
 * to undo: a browser may coalesce two gestures into one traversal, and the
 * reader must not be left with an address describing a screen they cannot see.
 */
export function gestureHome(): string | undefined {
  const guard = armed[armed.length - 1];
  return guard?.holds() ? guard.home() : undefined;
}
