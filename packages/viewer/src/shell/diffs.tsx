/**
 * The comparison band of an entry's workspace, in the right panel. This
 * container reads the comparison controller; `@mokly/ui/comparison-toolbar`
 * draws the band. The compare itself draws on the canvas's frames, under
 * `comparison_canvas.tsx`.
 */

import { ComparisonToolbar } from "@mokly/ui/comparison-toolbar";

import type { ComparisonController } from "./use_comparison.js";
import { useScrollTogether } from "./use_scroll_together.js";

/**
 * The comparison band of a controller owned by the workspace: the compare
 * modes, Scroll together and Refresh, which the right panel holds, and the
 * outcome line of each compared frame once the comparison is loaded.
 */
export function ComparisonBand({
  comparison,
  eligible = true,
  outcomes = [],
}: {
  comparison: ComparisonController;
  eligible?: boolean;
  /** The outcome line of each compared frame, such as `Desktop · Light · Screen changed`. */
  outcomes?: readonly string[];
}) {
  const together = useScrollTogether();
  return (
    <ComparisonToolbar
      current={comparison.mode === "current"}
      eligible={eligible}
      loaded={comparison.loaded !== undefined}
      mode={comparison.mode}
      onMode={comparison.selectMode}
      onRefresh={comparison.refresh}
      onTogether={together.set}
      outcomes={outcomes}
      together={together.on}
    />
  );
}
