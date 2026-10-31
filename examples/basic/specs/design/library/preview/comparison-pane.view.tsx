import { ComparisonPane } from "../../../../../../packages/ui/src/comparison-pane/comparison-pane.js";

import type { ComparisonPaneProps } from "./comparison-pane.js";
import { FrameSettingScope } from "./frame_placement.js";

/**
 * The shipped pane of one version in Side by side: its label, then the frame
 * of its slot as the chrome of a comparison, or the message of a version
 * that has no document. The pane names its side as the shell does, Before or
 * Current, so `label` repeats that name.
 */
export function ComparisonPaneView({
  children,
  message,
  side,
  state,
}: ComparisonPaneProps) {
  return (
    <ComparisonPane
      missing={state === "missing" ? (message ?? "") : undefined}
      side={side}
    >
      <FrameSettingScope setting="pane">{children}</FrameSettingScope>
    </ComparisonPane>
  );
}
