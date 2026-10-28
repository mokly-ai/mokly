/**
 * The canonical order of an entry detail's review v8 reasons: the kind's name,
 * then its `path` or `screenPath`. Keys compare by UTF-16 code units, as the
 * producer sorts them.
 */

import type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";

/** One reason's sort key: its kind, a separator, then its target. */
function reasonKey(reason: EntryChangeReason): string {
  return `${reason.kind}\u0000${
    reason.kind === "dependency"
      ? reason.path
      : reason.kind === "screen"
        ? reason.screenPath
        : ""
  }`;
}

/** Whether every reason's key is strictly above the one before it. */
export function reasonsInOrder(reasons: readonly EntryChangeReason[]): boolean {
  return reasons.every(
    (reason, index) =>
      index === 0 || reasonKey(reasons[index - 1]!) < reasonKey(reason),
  );
}
