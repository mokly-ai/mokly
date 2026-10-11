/** Classify screens from their rendered output. */

import type { ScreenReview } from "@mokly/viewer/data";

/** Changed views include retained resource impact; ignored-only views do not. */
export function hasOutputChange(screen: ScreenReview): boolean {
  return ["added", "removed", "changed"].includes(screen.state);
}
