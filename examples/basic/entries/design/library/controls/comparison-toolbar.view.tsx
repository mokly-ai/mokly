import { SelectionControl } from "../../parts/selection_control.js";
import { useDesignStyle } from "../style_context.js";

import type { ComparisonToolbarProps } from "./comparison-toolbar.js";

const modes = [
  ["current", "Current"],
  ["side-by-side", "Side by side"],
  ["overlay", "Overlay"],
  ["difference", "Difference"],
] as const;

/**
 * Scroll together, the native switch that follows the mode group in every
 * diff mode. It toggles in place and opens nothing, because a static artboard
 * has no versions to scroll.
 */
function ScrollTogether({ on }: { on: boolean }) {
  return (
    <label className="mbk-cmp-sync">
      <input type="checkbox" role="switch" defaultChecked={on} />
      <span className="mbk-cmp-sync-track" aria-hidden="true" />
      Scroll together
    </label>
  );
}

export function ComparisonToolbarView({
  mode,
  eligible,
  accessible,
  scrollTogether,
  destinations,
}: ComparisonToolbarProps) {
  useDesignStyle("comparison-toolbar", eligible);
  if (!eligible) return null;
  return (
    <div className="mbk-cmp-toolbar">
      <span className="mbk-seg" role="group" aria-label="Comparison mode">
        {modes.map(([key, label]) => (
          <SelectionControl
            key={key}
            accessible={accessible}
            active={key === mode}
            label={label}
            to={key === mode ? undefined : destinations[key]}
          />
        ))}
      </span>
      {mode !== "current" ? (
        <>
          <ScrollTogether on={scrollTogether} />
          <span className="mbk-cmp-refresh" aria-label="Refresh comparison">
            ↻
          </span>
        </>
      ) : null}
    </div>
  );
}
