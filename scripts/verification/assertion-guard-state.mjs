/** Keep assertion counts for the open sequential test ancestry. */

/** Test contexts and their active assertion frames. */
export const activeFrames = new Map();

/** Give each open ancestor credit for one assertion read or direct call. */
export function recordAssertion() {
  for (const frame of activeFrames.values()) frame.count += 1;
}
