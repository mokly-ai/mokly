import { useDesignInstance } from "../../library/composition.js";
import { viewControls } from "../../library/controls/view-controls.js";
import { useDepictedView } from "../../parts/depicted_view.js";
import { highlightProps, type ArtboardViewport } from "../../parts/shell.js";

/**
 * Screen adapters supply recorded inputs to the same native view controls.
 * The Highlight components toggle shows the state that the shell shows for
 * the view that the workspace depicts.
 */
export function ViewControls({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <viewControls.Component
      moklyInstance={useDesignInstance("view-controls")}
      selection={viewport}
      {...highlightProps(useDepictedView().highlight)}
    />
  );
}
