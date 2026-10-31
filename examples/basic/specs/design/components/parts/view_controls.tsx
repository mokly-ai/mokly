import { useDesignInstance } from "../../library/composition.js";
import { viewControls } from "../../library/controls/view-controls.js";
import {
  highlightProps,
  type ArtboardViewport,
  type HighlightState,
} from "../../parts/shell.js";

/** Screen adapters supply recorded inputs to the same native view controls. */
export function ViewControls({
  viewport,
  highlight,
}: {
  viewport: ArtboardViewport;
  /** The Highlight components state that the shell shows for this view. */
  highlight: HighlightState;
}) {
  return (
    <viewControls.Component
      moklyInstance={useDesignInstance("view-controls")}
      selection={viewport}
      {...highlightProps(highlight)}
    />
  );
}
