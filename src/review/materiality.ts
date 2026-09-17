/** Separate comparison output changes from diagnostic impact evidence. */

import type { ScreenReview } from "@mokly/viewer/data";

/** Return whether a screen has impact evidence without a material output change. */
export function isImpactOnly(screen: ScreenReview): boolean {
  return !hasOutputChange(screen) && screen.sharedImpact.length > 0;
}

/** Changed views include retained resource impact; ignored-only views do not. */
export function hasOutputChange(screen: ScreenReview): boolean {
  return ["added", "removed", "changed"].includes(screen.state);
}
