import { useId } from "react";

import { ViewControls } from "../../../../../../packages/ui/src/view-controls/view-controls.js";
import { HIGHLIGHT_REASONS } from "../inspector/frames-filter.view.js";

import type { ViewControlsProps } from "./view-controls.js";

/**
 * The shipped view controls. A static artboard runs no script, so the
 * viewport select and the Highlight components switch are native controls
 * whose state the design stylesheets read: they change the previews and the
 * highlight in place, even in Browse's sandboxed frames. The switch starts in
 * the state that the shell shows for the depicted view, and a reason disables
 * it. A changed view in another viewport marks the select.
 */
export function ViewControlsView({
  selection,
  highlight,
  unavailable,
  changedViews,
}: ViewControlsProps) {
  const markId = useId();
  const reason = unavailable ? HIGHLIGHT_REASONS[unavailable] : undefined;
  return (
    <ViewControls
      highlight={{ active: highlight, available: reason === undefined, reason }}
      interactive={false}
      viewport={selection}
      viewportMark={{
        id: markId,
        marked:
          selection !== "both" &&
          (changedViews ?? []).some((view) => view.viewport !== selection),
        text: "Other viewport changed",
      }}
    />
  );
}
