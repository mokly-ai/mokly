import { optional, useDesignInstance } from "../../library/composition.js";
import { viewControls } from "../../library/controls/view-controls.js";
import { useRenderedAppearance } from "../../parts/appearance.js";
import { useDesignNavigation } from "../../parts/design_navigation.js";
import type { PreviewModeState } from "../../parts/navigation_states.js";
import type { ArtboardViewport } from "../../parts/shell.js";

export interface HighlightOption {
  active: boolean;
  unavailable:
    | "empty"
    | "unavailable"
    | "loading"
    | "comparison"
    | "removed"
    | "live"
    | undefined;
}

/**
 * The artboard's own navigation record decides whether this view offers Live.
 * A catalogue without it keeps the toolbar unchanged, with no placeholder gap.
 */
export function previewModeProps(preview: PreviewModeState | undefined) {
  if (!preview) return {};
  return {
    previewMode: preview.mode,
    previewModeDestinations: {
      ...optional("static", preview.links?.static),
      ...optional("live", preview.links?.live),
    },
    ...optional("previewModeDisabled", preview.unavailable),
  };
}

/** Screen adapters supply recorded inputs to the same native view controls. */
export function ViewControls({
  viewport,
  highlight,
}: {
  viewport: ArtboardViewport;
  highlight?: HighlightOption | undefined;
}) {
  const navigation = useDesignNavigation();
  return (
    <viewControls.Component
      moklyInstance={useDesignInstance("view-controls")}
      selection={viewport}
      {...previewModeProps(navigation.preview)}
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
