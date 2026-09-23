import { optional, useDesignInstance } from "../../library/composition.js";
import { viewControls } from "../../library/controls/view-controls.js";
import { useRenderedAppearance } from "../../parts/appearance.js";
import type { ArtboardViewport } from "../../parts/shell.js";

export interface HighlightOption {
  active: boolean;
  unavailable: "empty" | "unavailable" | "comparison" | "removed" | undefined;
}

/** Screen adapters supply recorded inputs to the same native view controls. */
export function ViewControls({
  viewport,
  highlight,
}: {
  viewport: ArtboardViewport;
  highlight?: HighlightOption;
}) {
  return (
    <viewControls.Component
      moklyInstance={useDesignInstance("view-controls")}
      selection={viewport}
      {...optional("highlight", highlight?.active)}
      {...optional("unavailable", highlight?.unavailable)}
    />
  );
}

/** The depicted preview scheme, which follows the artboard it renders in. */
export function PreviewScheme() {
  return (
    <span className="ce-scheme">
      {useRenderedAppearance() === "dark" ? "Dark" : "Light"}
    </span>
  );
}
