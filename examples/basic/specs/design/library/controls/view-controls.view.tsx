import { useId } from "react";

import { ViewControls } from "../../../../../../packages/ui/src/view-controls/view-controls.js";

import type { ViewControlsProps } from "./view-controls.js";

/**
 * The shell's own sentence for each reason that disables Highlight
 * components, word for word, so a depicted toggle reads as the shell's does.
 */
const reasons = {
  empty: "No registered components are used in this view.",
  unavailable: "Component inspection is unavailable for this view.",
  loading: "Waiting for the component preview.",
  failed: "This preview could not be loaded.",
  comparison: "A comparison is selected. Highlighting is available in Current.",
  removed: "This preview is unavailable.",
} as const;

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
  const reason = unavailable ? reasons[unavailable] : undefined;
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
