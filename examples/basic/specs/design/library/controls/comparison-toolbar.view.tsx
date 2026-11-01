import { mockLink } from "@mokly/mokly";

import {
  ComparisonToolbar,
  type ComparisonMode as ToolbarMode,
} from "../../../../../../packages/ui/src/comparison-toolbar/comparison-toolbar.js";
import type { ComparisonMode } from "../../parts/destinations.js";

import type { ComparisonToolbarProps } from "./comparison-toolbar.js";

/** The shipped band's name for each saved mode, and the reverse. */
const TOOLBAR_MODES = {
  current: "current",
  "side-by-side": "side",
  overlay: "overlay",
  difference: "difference",
} as const satisfies Record<ComparisonMode, ToolbarMode>;
const SAVED_MODES = {
  current: "current",
  side: "side-by-side",
  overlay: "overlay",
  difference: "difference",
} as const satisfies Record<ToolbarMode, ComparisonMode>;

/** A static artboard runs no script, so the band's callbacks do nothing. */
function ignore() {}

/**
 * The shipped comparison band. A mode with a destination links to the
 * artboard that shows it, and the shown mode never links. An accessible band
 * draws the other modes and Refresh as native buttons, as the component
 * explorer depicts them; otherwise they are inert. A static artboard has a
 * loaded comparison, so every diff mode draws Refresh.
 */
export function ComparisonToolbarView({
  mode,
  eligible,
  accessible,
  scrollTogether,
  destinations,
}: ComparisonToolbarProps) {
  return (
    <ComparisonToolbar
      current={mode === "current"}
      eligible={eligible}
      interactive={accessible}
      loaded
      mode={TOOLBAR_MODES[mode]}
      modeHref={(shown) => {
        const saved = SAVED_MODES[shown];
        const destination = saved === mode ? undefined : destinations[saved];
        return destination === undefined ? undefined : mockLink(destination);
      }}
      onMode={ignore}
      onRefresh={ignore}
      onTogether={ignore}
      together={scrollTogether}
    />
  );
}
