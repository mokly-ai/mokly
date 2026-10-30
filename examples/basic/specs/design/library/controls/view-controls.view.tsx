import { useId } from "react";

import { ViewControls } from "../../../../../../packages/ui/src/view-controls/view-controls.js";

import type { ViewControlsProps } from "./view-controls.js";

const reasons = {
  empty: "No registered components in this view",
  unavailable: "Component inspection is unavailable",
  loading: "Waiting for the component preview.",
  comparison: "A comparison is selected. Highlighting is available in Current.",
  removed: "Highlighting is unavailable for removed screens",
} as const;

/**
 * The shipped view controls. A static artboard runs no script, so the
 * viewport select and the Highlight components switch are native controls
 * whose state the design stylesheets read: they change the previews and the
 * highlight in place, even in Browse's sandboxed frames. A changed view in
 * another viewport marks the select.
 */
export function ViewControlsView({
  selection,
  highlight,
  unavailable,
  changedViews,
}: ViewControlsProps) {
  const markId = useId();
  const reason = unavailable ? reasons[unavailable] : undefined;
  return (
    <ViewControls
      highlight={
        highlight === undefined
          ? undefined
          : { active: highlight, available: reason === undefined, reason }
      }
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
