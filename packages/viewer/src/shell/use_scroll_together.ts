/** The Scroll together choice of the viewer a comparison belongs to. */

import { useSyncExternalStore } from "react";

import { useComparisonEnvironment } from "./comparison_context.js";
import { FIXED_SCROLL_TOGETHER } from "./comparison_scroll_preference.js";

/** The reader's current choice and the action that changes it. */
export interface ScrollTogether {
  on: boolean;
  set(on: boolean): void;
}

const serverChoice = () => true;

/**
 * Read the mounted viewer's Scroll together choice. Server rendering and the
 * hydration render show it on; the stored choice follows right after, so a
 * standalone document never mismatches its server markup.
 */
export function useScrollTogether(): ScrollTogether {
  const preference =
    useComparisonEnvironment()?.scrollTogether ?? FIXED_SCROLL_TOGETHER;
  const on = useSyncExternalStore(
    preference.subscribe,
    preference.read,
    serverChoice,
  );
  return { on, set: preference.write };
}
